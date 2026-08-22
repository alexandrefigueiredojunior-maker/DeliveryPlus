import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { useEmpresa } from '../../contexts/EmpresaContext';
import { supabase } from '../../lib/supabase';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, lat?: number, lng?: number) => void;
  placeholder?: string;
  className?: string;
  locationBias?: { lat: number; lng: number };
}

export default function AddressAutocomplete(props: AddressAutocompleteProps) {
  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [scriptError, setScriptError] = useState(false);
  const [placesLibrary, setPlacesLibrary] = useState<any>(null);
  const [opConfig, setOpConfig] = useState<{
    latitude_operacao: number | null;
    longitude_operacao: number | null;
    raio_operacao_km: number | null;
  } | null>(null);

  let empresa: any = null;
  try {
    const context = useEmpresa();
    empresa = context.empresa;
  } catch (e) {
    // Fallback if useEmpresa is used outside an EmpresaProvider
  }

  useEffect(() => {
    if (!empresa?.id) return;

    const fetchConfig = async () => {
      try {
        const { data, error } = await supabase
          .from('configuracoes_empresas')
          .select('latitude_operacao, longitude_operacao, raio_operacao_km')
          .eq('empresa_id', empresa.id)
          .maybeSingle();

        if (error) {
          console.error("Erro ao carregar configuracoes_empresas para AddressAutocomplete:", error);
          return;
        }

        if (data) {
          setOpConfig({
            latitude_operacao: data.latitude_operacao ? Number(data.latitude_operacao) : null,
            longitude_operacao: data.longitude_operacao ? Number(data.longitude_operacao) : null,
            raio_operacao_km: data.raio_operacao_km ? Number(data.raio_operacao_km) : null,
          });
        }
      } catch (err) {
        console.error("Erro na busca de configuracoes_empresas:", err);
      }
    };

    fetchConfig();
  }, [empresa?.id]);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      console.warn("VITE_GOOGLE_MAPS_API_KEY não encontrada no ambiente.");
      setScriptError(true);
      return;
    }

    const loadPlacesLibrary = async () => {
      try {
        // If Google Maps is already loaded globally, import places directly
        if (typeof window !== 'undefined' && (window as any).google?.maps?.importLibrary) {
          const library = await (window as any).google.maps.importLibrary("places");
          setPlacesLibrary(library);
          setScriptLoaded(true);
          return;
        }

        // Wait if another script element is already loading Google Maps
        const existingScript = document.getElementById('google-maps-modern-script');
        if (existingScript) {
          const handleLoaded = async () => {
            try {
              const library = await (window as any).google.maps.importLibrary("places");
              setPlacesLibrary(library);
              setScriptLoaded(true);
            } catch (err) {
              setScriptError(true);
            }
          };
          existingScript.addEventListener('load', handleLoaded);
          return;
        }

        // Create script tag for Bootstrap Modern Maps Javascript API
        const script = document.createElement('script');
        script.id = 'google-maps-modern-script';
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&v=weekly`;
        script.async = true;
        script.defer = true;

        script.addEventListener('load', async () => {
          try {
            const library = await (window as any).google.maps.importLibrary("places");
            setPlacesLibrary(library);
            setScriptLoaded(true);
          } catch (err) {
            console.error("Erro ao importar a biblioteca 'places' do Google:", err);
            setScriptError(true);
          }
        });

        script.addEventListener('error', () => {
          console.error("Erro ao carregar o script do Google Maps.");
          setScriptError(true);
        });

        document.head.appendChild(script);
      } catch (error) {
        console.error("Erro ao carregar o ecossistema do Google Maps:", error);
        setScriptError(true);
      }
    };

    loadPlacesLibrary();
  }, []);

  if (scriptError) {
    // Fallback simples para input clássico sem travar a interface em caso de falha de carregamento do SDK
    return (
      <input
        type="text"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder || "Rua, número, bairro..."}
        className={`w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold ${props.className || ''}`}
      />
    );
  }

  if (!scriptLoaded || !placesLibrary) {
    return (
      <div className="relative w-full">
        <input
          type="text"
          value={props.value}
          readOnly
          placeholder={props.placeholder || "Carregando buscador..."}
          className={`w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none font-bold text-neutral-400 ${props.className || ''}`}
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      </div>
    );
  }

  return <GoogleAddressAutocompleteInner {...props} placesLibrary={placesLibrary} opConfig={opConfig} />;
}

// Inner helper component using the modern loaded placesLibrary
function GoogleAddressAutocompleteInner({
  value,
  onChange,
  placeholder = "Rua, número, bairro...",
  className = "",
  locationBias,
  placesLibrary,
  opConfig,
}: AddressAutocompleteProps & { placesLibrary: any; opConfig: any }) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [inputValue, setValue] = useState(value);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>('');

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<any>(null);

  // Sync state with outside value changes
  useEffect(() => {
    setValue(value);
  }, [value]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const fetchSuggestions = async (input: string) => {
    if (!input || input.trim().length < 3) {
      setSuggestions([]);
      setStatus('');
      return;
    }

    setLoading(true);
    try {
      const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLibrary;

      if (!AutocompleteSuggestion || typeof AutocompleteSuggestion.fetchAutocompleteSuggestions !== 'function') {
        console.warn("API moderna AutocompleteSuggestion.fetchAutocompleteSuggestions indisponível.");
        setLoading(false);
        return;
      }

      // Initialize session token if we don't have one
      let sessionTokenToUse = sessionTokenRef.current;
      if (!sessionTokenToUse && AutocompleteSessionToken) {
        sessionTokenToUse = new AutocompleteSessionToken();
        sessionTokenRef.current = sessionTokenToUse;
      }

      const request: any = {
        input,
        language: 'pt-BR',
        includedRegionCodes: ['BR'],
      };

      if (sessionTokenToUse) {
        request.sessionToken = sessionTokenToUse;
      }

      const latitude_operacao = opConfig?.latitude_operacao;
      const longitude_operacao = opConfig?.longitude_operacao;
      const raio_operacao_km = opConfig?.raio_operacao_km;

      console.log('Latitude Operação:', latitude_operacao);
      console.log('Longitude Operação:', longitude_operacao);
      console.log('Raio Operação:', raio_operacao_km);

      if (latitude_operacao && longitude_operacao && raio_operacao_km) {
        request.locationBias = {
          center: {
            lat: latitude_operacao,
            lng: longitude_operacao
          },
          radius: raio_operacao_km * 1000
        };
      } else if (locationBias) {
        request.locationBias = new (window as any).google.maps.LatLng(locationBias.lat, locationBias.lng);
      }

      const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      
      // DIAGNOSTIC LOGS REQUESTED BY THE USER
      console.log("=== AUTOCOMPLETE DIAGNOSTIC START ===");
      console.log("1. response:", response);
      if (response) {
        console.log("2. response.suggestions:", response.suggestions);
        if (response.suggestions && response.suggestions.length > 0) {
          const firstSuggestion = response.suggestions[0];
          console.log("3. response.suggestions[0]:", firstSuggestion);
          
          const pred = firstSuggestion.placePrediction;
          console.log("4. placePrediction:", pred);
          
          if (pred) {
            console.log("5. text:", pred.text?.text);
            console.log("6. mainText:", pred.structuredFormat?.mainText?.text);
            console.log("7. secondaryText:", pred.structuredFormat?.secondaryText?.text);
          }
        } else {
          console.log("Nenhuma sugestão retornada na lista.");
        }
      }
      console.log("=== AUTOCOMPLETE DIAGNOSTIC END ===");

      const results = response.suggestions || [];
      setSuggestions(results);
      setStatus(results.length > 0 ? 'OK' : 'ZERO_RESULTS');
    } catch (error) {
      console.error("Erro ao obter sugestões do Google Places (New):", error);
      setSuggestions([]);
      setStatus('ERROR');
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setValue(val);
    onChange(val);
    setShowSuggestions(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 400);
  };

  const handleSelect = async (suggestion: any) => {
    const placePrediction = suggestion.placePrediction;
    if (!placePrediction) return;

    const placeId = placePrediction.placeId;
    const fallbackAddress = placePrediction.text?.text || "";

    setSuggestions([]);
    setShowSuggestions(false);
    
    // Clear session token sequence so a new session begins on next typing interaction
    sessionTokenRef.current = null;

    if (!placeId) {
      setValue(fallbackAddress);
      onChange(fallbackAddress);
      return;
    }

    setLoading(true);
    try {
      const { Place } = placesLibrary;
      if (Place) {
        // Modern Place details request (fully supported for post-March 2025 projects)
        const placeInstance = new Place({ id: placeId });
        await placeInstance.fetchFields({
          fields: ['location', 'formattedAddress']
        });

        if (placeInstance.location) {
          const lat = placeInstance.location.lat();
          const lng = placeInstance.location.lng();
          const addr = placeInstance.formattedAddress || fallbackAddress;
          setValue(addr);
          onChange(addr, lat, lng);
        } else {
          setValue(fallbackAddress);
          onChange(fallbackAddress);
        }
      } else {
        setValue(fallbackAddress);
        onChange(fallbackAddress);
      }
    } catch (error) {
      console.error("Erro ao carregar detalhes do Place modernos:", error);
      setValue(fallbackAddress);
      onChange(fallbackAddress);
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = () => {
    setTimeout(() => {
      setShowSuggestions(false);
    }, 250);
  };

  const isSearching = loading;
  const noResults = status === 'ZERO_RESULTS';

  return (
    <div className="relative w-full">
      <input
        value={inputValue}
        onChange={handleInput}
        placeholder={placeholder}
        className={`w-full px-5 py-4 bg-neutral-50 border border-neutral-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-600 transition-all font-bold ${className}`}
        onBlur={handleBlur}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
      />

      {isSearching && inputValue.length >= 3 && (
        <div className="absolute right-4 top-1/2 -translate-y-1/2">
          <Loader2 className="h-4 w-4 animate-spin text-neutral-400" />
        </div>
      )}

      {showSuggestions && suggestions.length > 0 && (
        <ul className="absolute z-[200] w-full mt-2 bg-white border border-neutral-200 rounded-2xl shadow-xl overflow-hidden max-h-60 overflow-y-auto address-suggestions-list" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
          {suggestions.map((item, index) => {
            const prediction = item.placePrediction;
            if (!prediction) return null;

            let mainText = prediction.structuredFormat?.mainText?.text || "";
            let secondaryText = prediction.structuredFormat?.secondaryText?.text || "";

            if (!mainText) {
              let rawText = "";
              if (prediction.text?.text) {
                rawText = prediction.text.text;
              } else if (typeof prediction.text === 'string') {
                rawText = prediction.text;
              } else if (item.text) {
                rawText = item.text;
              } else if (prediction.formattedAddress) {
                rawText = prediction.formattedAddress;
              }

              if (rawText) {
                const parts = rawText.split(',');
                mainText = parts[0]?.trim() || "";
                secondaryText = parts.slice(1).join(',').trim() || "";
              }
            }

            const key = prediction.placeId || index;

            return (
              <li
                key={key}
                onClick={() => handleSelect(item)}
                className="px-5 py-3 hover:bg-neutral-50 cursor-pointer transition-colors border-b border-neutral-100 last:border-0 address-suggestion-item"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="text-neutral-400 mt-1 shrink-0" size={14} />
                  <div>
                    <p style={{ color: '#000000' }} className="text-sm font-bold text-neutral-900 line-clamp-1 main-text">{mainText}</p>
                    <p style={{ color: '#4b5563' }} className="text-[10px] font-medium text-neutral-600 line-clamp-2 secondary-text">{secondaryText}</p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {noResults && inputValue.length >= 3 && !loading && (
        <div className="absolute z-[200] w-full mt-2 bg-white border border-neutral-200 rounded-2xl shadow-xl p-4 text-center" style={{ backgroundColor: '#ffffff', borderColor: '#e5e7eb' }}>
          <p style={{ color: '#4b5563' }} className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Nenhum endereço encontrado</p>
        </div>
      )}
    </div>
  );
}
