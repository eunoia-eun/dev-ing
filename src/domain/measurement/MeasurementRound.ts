export interface MeasurementRound {
  id: string;
  name: string;
  startDate: string;
  endDate?: string;
  agency?: string;
  note?: string;
}

export interface MeasurementDocument {
  id: string;
  roundId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
  label?: string;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function suggestRoundName(startDate: string): string {
  const [year, month] = startDate.split('-').map(Number);
  const half = month <= 6 ? '상반기' : '하반기';
  return `${year}년 ${half} 정기측정`;
}
