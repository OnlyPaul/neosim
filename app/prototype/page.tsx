// app/prototype/page.tsx
// THROWAWAY — Phase 0 waveform prototype. Deleted after Phase 2 ships per D-01.
// Server Component shell only; all runtime work lives in PrototypeClient.tsx.
// T-00-03 (threat register): this route MUST be deleted before Phase 2 ships.
import PrototypeClient from './PrototypeClient';

export const metadata = { title: 'NeoSim — Waveform Prototype' };

export default function Page() {
  return <PrototypeClient />;
}
