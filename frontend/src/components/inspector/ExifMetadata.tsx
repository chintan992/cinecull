import type { ExifMetadata as ExifMetadataType } from '../../types/photo';

export function ExifMetadata({ metadata }: { metadata: ExifMetadataType }) {
  const hasData = Object.values(metadata).some((v) => v !== null);

  if (!hasData) {
    return <p className="text-[10px] text-chrome-500 italic">No EXIF data found.</p>;
  }

  const rows = [
    { label: 'Camera', value: [metadata.camera_make, metadata.camera_model].filter(Boolean).join(' ') },
    { label: 'Lens', value: metadata.lens },
    { label: 'Aperture', value: metadata.aperture },
    { label: 'ISO', value: metadata.iso },
    { label: 'Focal', value: metadata.focal_length },
    { label: 'Date', value: metadata.datetime_original },
  ].filter((r) => r.value);

  return (
    <div className="space-y-2">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex justify-between text-[9px] font-mono">
          <span className="text-chrome-500 uppercase tracking-wider">{label}</span>
          <span className="text-chrome-200 truncate ml-2 max-w-[140px]" title={value || undefined}>
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}
