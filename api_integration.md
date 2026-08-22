# Documentação da API de Integração de Pedidos

Esta API permite que sistemas externos (Cardápios Digitais, PDVs, etc.) criem entregas automaticamente no sistema DeliveryPlus.

## Endpoint

`POST https://<PROJETO>.supabase.co/functions/v1/criar-entrega`

## Cabeçalhos (Headers)

| Nome | Valor |
| :--- | :--- |
| `Content-Type` | `application/json` |

## Corpo da Requisição (JSON)

| Campo | Tipo | Obrigatório | Descrição |
| :--- | :--- | :--- | :--- |
| `api_key` | `string` | Sim | Chave de API exclusiva da empresa. |
| `restaurante_id` | `string` | Sim | ID do restaurante (UUID). |
| `numero` | `string` | Sim | Número identificador do pedido no sistema de origem. |
| `cliente_nome` | `string` | Não | Nome do cliente. |
| `cliente_telefone` | `string` | Não | Telefone do cliente. |
| `endereco_entrega` | `string` | Sim | Endereço completo para entrega. |
| `latitude_entrega` | `number` | Não | Latitude do local de entrega (usado para cálculo de KM). |
| `longitude_entrega` | `number` | Não | Longitude do local de entrega (usado para cálculo de KM). |
| `forma_pagamento` | `string` | Não | Ex: Dinheiro, Cartão, Já Pago. |
| `observacao` | `string` | Não | Observações extras para o motoboy. |
| `valor_pedido` | `number` | Não | Valor total dos itens do pedido. |

## Exemplo de Requisição (cURL)

```bash
curl -X POST "https://<PROJETO>.supabase.co/functions/v1/criar-entrega" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "sua-chave-aqui",
    "restaurante_id": "restaurante-uuid-aqui",
    "numero": "12345",
    "cliente_nome": "João Silva",
    "cliente_telefone": "11999999999",
    "endereco_entrega": "Av. Paulista, 1000 - Bela Vista, São Paulo - SP",
    "latitude_entrega": -23.5614,
    "longitude_entrega": -46.6558,
    "forma_pagamento": "Dinheiro - Troco para R$ 50",
    "valor_pedido": 45.90
  }'
```

## Respostas

### Sucesso (201 Created)

```json
{
  "sucesso": true,
  "entrega_id": "uuid-da-entrega",
  "numero": "12345"
}
```

### Erro (401 Unauthorized)

```json
{
  "error": "api_key inválida"
}
```

### Erro (403 Forbidden)

```json
{
  "error": "Esta empresa não permite pedidos externos"
}
```
