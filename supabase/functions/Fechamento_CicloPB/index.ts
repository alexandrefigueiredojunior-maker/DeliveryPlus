import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // Trata requisições pre-flight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar autenticação e autorização do usuário
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[Fechamento_CicloPB] Sem header de autorização");
      return new Response(
        JSON.stringify({
          sucesso: false,
          status: "acesso_negado",
          erro: "Acesso negado. Requer privilégios de Super Admin.",
          etapa: "autenticacao",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Cliente com o token do usuário para verificar permissões
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("[Fechamento_CicloPB] Falha na validação do usuário:", userError);
      return new Response(
        JSON.stringify({
          sucesso: false,
          status: "acesso_negado",
          erro: "Acesso negado. Requer privilégios de Super Admin.",
          etapa: "autenticacao",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o usuário é super admin via RPC ou metadata
    const { data: isSuperAdmin } = await supabaseUser.rpc("is_super_admin");
    const roleMeta = user.user_metadata?.role || user.app_metadata?.role;
    const eSuperAdmin = isSuperAdmin === true || roleMeta === "super_admin";

    if (!eSuperAdmin) {
      console.error("[Fechamento_CicloPB] Usuário não é Super Admin:", user.id);
      return new Response(
        JSON.stringify({
          sucesso: false,
          status: "acesso_negado",
          erro: "Acesso negado. Requer privilégios de Super Admin.",
          etapa: "autorizacao",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cliente Admin com SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Extrair parâmetros do body
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Body ausente ou vazio
      body = {};
    }

    const { acao, gerar_remessa, gerar_arquivo, restaurante_id } = body;
    let data_ciclo: string | null = body?.data_ciclo;

    // Se for ação de gerar remessa / arquivo XLSX
    const isGeracaoRemessa = acao === "gerar_remessa_xlsx" || acao === "gerar_remessa" || gerar_remessa === true || gerar_arquivo === true;

    if (isGeracaoRemessa) {
      console.log("[Fechamento_CicloPB] Iniciando geração da remessa XLSX...");

      // Buscar lotes de repasse pendentes
      let queryLotes = supabaseAdmin
        .from("lotes_repasse")
        .select("id, restaurante_id, valor_pago, status_repasse, data_inicio, data_fim, pago_em, created_at")
        .is("pago_em", null);

      if (restaurante_id) {
        queryLotes = queryLotes.eq("restaurante_id", restaurante_id);
      }

      if (data_ciclo) {
        queryLotes = queryLotes.or(`data_inicio.eq.${data_ciclo},data_fim.eq.${data_ciclo}`);
      }

      queryLotes = queryLotes.order("created_at", { ascending: true });

      const { data: rawLotes, error: lotesError } = await queryLotes;
      if (lotesError) {
        console.error("[Fechamento_CicloPB] Erro ao buscar lotes para remessa:", lotesError);
        return new Response(
          JSON.stringify({
            sucesso: false,
            status: "erro",
            erro: `Erro ao consultar lotes de repasse: ${lotesError.message}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const lotesPendentes = (rawLotes || []).filter((l: any) => {
        const st = (l.status_repasse || "").toString().trim().toLowerCase();
        return st !== "pago" && st !== "concluido" && st !== "paga";
      });

      if (lotesPendentes.length === 0) {
        return new Response(
          JSON.stringify({
            sucesso: false,
            status: "sem_lotes",
            erro: "Nenhum lote pendente de pagamento encontrado para os filtros selecionados.",
            mensagem: "Nenhum lote pendente de pagamento encontrado para os filtros selecionados.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar dados dos restaurantes relacionados
      const restIds = Array.from(new Set(lotesPendentes.map((l: any) => l.restaurante_id).filter(Boolean)));
      const { data: rawRestaurantes, error: restError } = await supabaseAdmin
        .from("restaurantes")
        .select("id, nome, pix_cpf, pix_nome_completo, pagbank_conta, pagbank_digito")
        .in("id", restIds);

      if (restError) {
        console.error("[Fechamento_CicloPB] Erro ao buscar restaurantes:", restError);
        return new Response(
          JSON.stringify({
            sucesso: false,
            status: "erro",
            erro: `Erro ao consultar restaurantes: ${restError.message}`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const restMap = new Map<string, any>();
      (rawRestaurantes || []).forEach((r: any) => restMap.set(r.id, r));

      // Baixar arquivo modelo do Supabase Storage
      // Bucket: Baldes, Pasta: Modelo, Arquivo: pagbank_arquivo_modelo.xlsx -> Caminho: Modelo/pagbank_arquivo_modelo.xlsx
      let BUCKET_NAME = "Baldes";
      const FILE_PATH = "Modelo/pagbank_arquivo_modelo.xlsx";

      console.log(`[Fechamento_CicloPB] Verificando buckets no Storage...`);
      try {
        const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
        if (listError) {
          console.warn("[Fechamento_CicloPB] Aviso ao listar buckets:", listError);
        } else if (buckets && buckets.length > 0) {
          console.log("[Fechamento_CicloPB] Buckets encontrados:", buckets.map((b: any) => `${b.id} (${b.name})`));
          const foundBucket = buckets.find(
            (b: any) =>
              b.id === "Baldes" ||
              b.name === "Baldes" ||
              b.id.toLowerCase() === "baldes" ||
              b.name.toLowerCase() === "baldes"
          );
          if (foundBucket) {
            BUCKET_NAME = foundBucket.id || foundBucket.name;
          }
        }
      } catch (errList) {
        console.warn("[Fechamento_CicloPB] Exceção ao listar buckets:", errList);
      }

      console.log(`[Fechamento_CicloPB] Baixando modelo do storage -> Bucket: ${BUCKET_NAME} | Caminho: ${FILE_PATH}`);

      let fileBuffer: ArrayBuffer | null = null;

      // 1. Tentativa via download() com service_role
      const { data: fileData, error: downloadError } = await supabaseAdmin.storage
        .from(BUCKET_NAME)
        .download(FILE_PATH);

      if (!downloadError && fileData) {
        fileBuffer = await fileData.arrayBuffer();
      } else {
        console.warn(`[Fechamento_CicloPB] Tentativa 1 com bucket '${BUCKET_NAME}' falhou:`, downloadError);

        // 2. Tentativa com variações de caminho ou bucket
        const pathsToTry = [
          { bucket: BUCKET_NAME, path: "modelo/pagbank_arquivo_modelo.xlsx" },
          { bucket: BUCKET_NAME, path: "pagbank_arquivo_modelo.xlsx" },
          { bucket: "Baldes", path: FILE_PATH },
          { bucket: "baldes", path: FILE_PATH },
        ];

        for (const attempt of pathsToTry) {
          try {
            const { data: altData, error: altErr } = await supabaseAdmin.storage
              .from(attempt.bucket)
              .download(attempt.path);
            if (!altErr && altData) {
              console.log(`[Fechamento_CicloPB] Sucesso ao baixar com bucket '${attempt.bucket}' caminho '${attempt.path}'`);
              fileBuffer = await altData.arrayBuffer();
              break;
            }
          } catch {}
        }

        // 3. Tentativa via URL pública / autenticada
        if (!fileBuffer) {
          try {
            const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET_NAME).getPublicUrl(FILE_PATH);
            if (publicUrlData?.publicUrl) {
              const resFetch = await fetch(publicUrlData.publicUrl, {
                headers: { Authorization: `Bearer ${supabaseServiceKey}` },
              });
              if (resFetch.ok) {
                fileBuffer = await resFetch.arrayBuffer();
                console.log("[Fechamento_CicloPB] Sucesso ao baixar via publicUrl com headers.");
              }
            }
          } catch (eUrl) {
            console.warn("[Fechamento_CicloPB] Erro na tentativa via publicUrl:", eUrl);
          }
        }
      }

      let workbook: any;

      if (fileBuffer) {
        workbook = XLSX.read(new Uint8Array(fileBuffer), { type: "array" });
      } else {
        console.warn(`[Fechamento_CicloPB] Modelo no Storage inacessível. Criando nova planilha no formato PagBank.`);
        // Fallback robusto: cria a planilha formatada no layout padrão PagBank
        const headers = [
          "Código Banco",
          "Agência",
          "Conta",
          "Dígito",
          "Tipo Conta",
          "Nome Favorecido",
          "CPF/CNPJ",
          "Valor (R$)",
          "ID Lote / Identificação",
        ];
        const ws = XLSX.utils.aoa_to_sheet([headers]);
        workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, ws, "PagBank");
      }

      // Preparar linhas dos dados para preenchimento na planilha
      const sheetName = workbook.SheetNames[0] || "Planilha1";
      const worksheet = workbook.Sheets[sheetName];

      const rowsData: any[][] = [];

      for (const lote of lotesPendentes) {
        const rest = restMap.get(lote.restaurante_id);
        const conta = (rest?.pagbank_conta || "").toString().trim();
        const digito = (rest?.pagbank_digito || "").toString().trim();
        const nomeFavorecido = (rest?.pix_nome_completo || rest?.nome || "").toString().trim();
        const cpfCnpjRaw = (rest?.pix_cpf || "").toString().trim().replace(/\D/g, "");
        const valor = Number(lote.valor_pago) || 0;
        const valorFormatado = Math.round(valor * 100) / 100;

        rowsData.push([
          290,                  // Código Banco (PagBank)
          "0001",               // Agência
          conta,                // Conta
          digito,               // Dígito
          "Conta Corrente",     // Tipo Conta
          nomeFavorecido,       // Nome Favorecido
          cpfCnpjRaw,           // CPF/CNPJ
          valorFormatado,       // Valor (R$)
          lote.id,              // Identificação / ID Lote
        ]);
      }

      // Se a planilha já existir no modelo, adiciona as linhas a partir do final ou preenche
      XLSX.utils.sheet_add_aoa(worksheet, rowsData, { origin: -1 });

      const outputBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

      const now = new Date();
      const dataStr = now.toISOString().split("T")[0];
      const nomeArquivo = `remessa_pagbank_${data_ciclo || dataStr}.xlsx`;

      console.log(`[Fechamento_CicloPB] Remessa XLSX gerada com sucesso: ${rowsData.length} linhas | Arquivo: ${nomeArquivo}`);

      return new Response(outputBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        },
      });
    }

    // Se a data do ciclo não for informada, utiliza a data atual no fuso America/Sao_Paulo
    if (!data_ciclo) {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      data_ciclo = formatter.format(new Date()); // Ex: "2026-08-12"
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_ciclo)) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          status: "erro",
          erro: "Formato de data inválido. Utilize YYYY-MM-DD.",
          etapa: "validacao_data",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Calcular janela de tempo no fuso America/Sao_Paulo (UTC-3)
    const [year, month, day] = data_ciclo.split("-").map(Number);
    const startDate = new Date(Date.UTC(year, month - 1, day, 3, 0, 0));
    const endDate = new Date(Date.UTC(year, month - 1, day + 1, 3, 0, 0));

    const p_inicio_ciclo = startDate.toISOString(); // 2026-08-12T03:00:00.000Z
    const p_fim_ciclo = endDate.toISOString();    // 2026-08-13T03:00:00.000Z

    // 4. Buscar TODOS os pagamentos do ciclo dentro do intervalo UTC-3
    const { data: todosPagamentos, error: pagError } = await supabaseAdmin
      .from("pagamentos_pagbank")
      .select("id, restaurante_id, status_pagamento, status_repasse, valor_restaurante, valor_total, lote_repasse_id, created_at")
      .gte("created_at", p_inicio_ciclo)
      .lt("created_at", p_fim_ciclo);

    if (pagError) {
      console.error("[Fechamento_CicloPB] Erro ao consultar pagamentos:", pagError);
      return new Response(
        JSON.stringify({
          sucesso: false,
          status: "erro",
          erro: `Erro ao consultar pagamentos: ${pagError.message}`,
          etapa: "busca_pagamentos",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listaPagamentos = todosPagamentos || [];

    // Obter lista única de restaurantes com pagamentos no período
    const restauranteIds = Array.from(
      new Set(listaPagamentos.map((p) => p.restaurante_id).filter(Boolean))
    );

    console.log(`[Fechamento_CicloPB] Data Ciclo: ${data_ciclo} | Inicio UTC: ${p_inicio_ciclo} | Fim UTC: ${p_fim_ciclo} | Total Pagamentos no período: ${listaPagamentos.length} | Restaurantes: ${restauranteIds.length}`);

    let totalPagamentosGeral = 0;
    let valorTotalGeral = 0;
    let lotesCriadosCount = 0;

    for (const restId of restauranteIds) {
      const pagamentosDoRestaurante = listaPagamentos.filter((p) => p.restaurante_id === restId);

      // 1. Pagamentos Aprovados
      const pagamentosAprovados = pagamentosDoRestaurante.filter((p) => {
        const st = (p.status_pagamento || "").toString().trim().toLowerCase();
        return st === "aprovado" || st === "paid" || st === "approved";
      });

      const valAprovados = pagamentosAprovados.reduce((acc, p) => {
        const v = Number(p.valor_restaurante) || Number(p.valor_total) || 0;
        return acc + v;
      }, 0);

      console.log("FECHAMENTO CICLO - PAGAMENTOS APROVADOS", {
        restaurante_id: restId,
        data_ciclo: data_ciclo,
        quantidade_pagamentos: pagamentosAprovados.length,
        ids_pagamentos: pagamentosAprovados.map((p) => p.id),
        valor_total: Math.round(valAprovados * 100) / 100,
      });

      // 2. Pagamentos Já Acertados / Já Vinculados a Lote Anterior
      const pagamentosJaAcertados = pagamentosAprovados.filter((p) => {
        const temLote = Boolean(p.lote_repasse_id);
        const stRepasse = (p.status_repasse || "").toString().trim().toLowerCase();
        const repasseConcluido = stRepasse === "pago" || stRepasse === "concluido" || stRepasse === "acertado";
        return temLote || repasseConcluido;
      });

      const valJaAcertados = pagamentosJaAcertados.reduce((acc, p) => {
        const v = Number(p.valor_restaurante) || Number(p.valor_total) || 0;
        return acc + v;
      }, 0);

      const lotesVinculados = Array.from(
        new Set(pagamentosJaAcertados.map((p) => p.lote_repasse_id).filter(Boolean))
      );

      console.log("FECHAMENTO CICLO - PAGAMENTOS JÁ ACERTADOS", {
        restaurante_id: restId,
        data_ciclo: data_ciclo,
        quantidade_pagamentos: pagamentosJaAcertados.length,
        ids_pagamentos: pagamentosJaAcertados.map((p) => p.id),
        valor_total: Math.round(valJaAcertados * 100) / 100,
        lote_repasse_id: lotesVinculados.length > 0 ? lotesVinculados : null,
      });

      // 3. Pagamentos Pendentes de Acerto
      const pagamentosPendentesDeAcerto = pagamentosAprovados.filter((p) => {
        const semLote = !p.lote_repasse_id;
        const stRepasse = (p.status_repasse || "").toString().trim().toLowerCase();
        const repasseNaoConcluido = stRepasse !== "pago" && stRepasse !== "concluido" && stRepasse !== "acertado";
        return semLote && repasseNaoConcluido;
      });

      const valPendentes = pagamentosPendentesDeAcerto.reduce((acc, p) => {
        const v = Number(p.valor_restaurante) || Number(p.valor_total) || 0;
        return acc + v;
      }, 0);

      console.log("FECHAMENTO CICLO - PAGAMENTOS PENDENTES", {
        restaurante_id: restId,
        data_ciclo: data_ciclo,
        quantidade_pagamentos: pagamentosPendentesDeAcerto.length,
        ids_pagamentos: pagamentosPendentesDeAcerto.map((p) => p.id),
        valor_total: Math.round(valPendentes * 100) / 100,
      });

      // Se não há pagamentos pendentes de acerto para este restaurante, não cria lote
      if (pagamentosPendentesDeAcerto.length === 0) {
        continue;
      }

      // 4. Criar Novo Lote de Repasse para o Restaurante com os pagamentos pendentes
      const valorLoteFormatado = Math.round(valPendentes * 100) / 100;
      const { data: novoLote, error: loteInsertError } = await supabaseAdmin
        .from("lotes_repasse")
        .insert({
          restaurante_id: restId,
          data_inicio: data_ciclo,
          data_fim: data_ciclo,
          valor_pago: valorLoteFormatado,
          status_repasse: "Pendente",
          pago_em: null,
          comprovante_url: null,
        })
        .select("id, restaurante_id, data_inicio, data_fim, valor_pago, status_repasse, created_at")
        .single();

      if (loteInsertError || !novoLote) {
        console.error(`[Fechamento_CicloPB] Erro ao criar lote de repasse para restaurante ${restId}:`, loteInsertError);
        continue;
      }

      const idsPendentes = pagamentosPendentesDeAcerto.map((p) => p.id);

      // Vincular SOMENTE os pagamentos pendentes ao novo lote
      const { error: updatePagsError } = await supabaseAdmin
        .from("pagamentos_pagbank")
        .update({
          lote_repasse_id: novoLote.id,
          status_repasse: "Pendente",
        })
        .in("id", idsPendentes);

      if (updatePagsError) {
        console.error(`[Fechamento_CicloPB] Erro ao vincular pagamentos ao lote ${novoLote.id}:`, updatePagsError);
      }

      console.log("FECHAMENTO CICLO - NOVO LOTE", {
        restaurante_id: restId,
        data_ciclo: data_ciclo,
        lote_repasse_id: novoLote.id,
        quantidade_pagamentos: idsPendentes.length,
        ids_pagamentos: idsPendentes,
        valor_total: valorLoteFormatado,
      });

      totalPagamentosGeral += idsPendentes.length;
      valorTotalGeral += valPendentes;
      lotesCriadosCount += 1;
    }

    console.log(`[Fechamento_CicloPB] Resumo final -> Lotes Criados: ${lotesCriadosCount} | Pagamentos: ${totalPagamentosGeral} | Valor Total: R$ ${valorTotalGeral.toFixed(2)}`);

    if (lotesCriadosCount === 0 && totalPagamentosGeral === 0) {
      const semPagamentosResp = {
        sucesso: false,
        status: "sem_pagamentos",
        erro: "Nenhum pagamento aprovado pendente encontrado para este ciclo.",
        mensagem: "Nenhum pagamento aprovado pendente encontrado para este ciclo.",
        data_ciclo: data_ciclo,
        quantidade_pagamentos: 0,
        valor_total: 0,
        lotes_criados: 0,
      };
      console.log("[Fechamento_CicloPB] Retorno: sem pagamentos pendentes");
      return new Response(JSON.stringify(semPagamentosResp), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const finalResponse = {
      sucesso: true,
      status: "sucesso",
      mensagem: "Ciclo fechado com sucesso.",
      data_ciclo: data_ciclo,
      quantidade_pagamentos: totalPagamentosGeral,
      valor_total: Math.round(valorTotalGeral * 100) / 100,
      lotes_criados: lotesCriadosCount,
    };

    console.log("[Fechamento_CicloPB] JSON final retornado:", JSON.stringify(finalResponse));

    return new Response(JSON.stringify(finalResponse), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[FECHAMENTO_CICLO_PB] Exceção capturada:", err);
    return new Response(
      JSON.stringify({
        sucesso: false,
        status: "erro",
        erro: err?.message || "Erro interno no processamento do ciclo.",
        etapa: "excecao_geral",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
