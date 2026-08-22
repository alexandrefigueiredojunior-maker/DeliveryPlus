export interface LocationTimeInfo {
  text: string;
  isOutdated: boolean;
  seconds: number | null;
}

export function formatLocationTime(timestamp?: string | null): LocationTimeInfo {
  if (!timestamp) {
    return {
      text: 'Localização desatualizada',
      isOutdated: true,
      seconds: null,
    };
  }

  const dateMs = new Date(timestamp).getTime();
  if (isNaN(dateMs)) {
    return {
      text: 'Localização desatualizada',
      isOutdated: true,
      seconds: null,
    };
  }

  const diffSec = Math.max(0, Math.floor((Date.now() - dateMs) / 1000));
  if (diffSec > 30) {
    return {
      text: 'Localização desatualizada',
      isOutdated: true,
      seconds: diffSec,
    };
  }

  return {
    text: `Atualizado há ${diffSec} segundo${diffSec === 1 ? '' : 's'}`,
    isOutdated: false,
    seconds: diffSec,
  };
}
