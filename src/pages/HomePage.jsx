import { useState, useEffect, useCallback, useRef } from 'react';
import { transcribeAudio, parseLog, fetchLogs } from '../api';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';
import VehiclePicker from '../components/VehiclePicker';
import RecordButton from '../components/RecordButton';
import LogCard from '../components/LogCard';
import EditModal from '../components/EditModal';
import NeedsReviewBanner from '../components/NeedsReviewBanner';

export default function HomePage({ session, vehicles, selectedVehicle, onSelectVehicle, onVehiclesUpdated }) {
  const [logs, setLogs] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [lastResult, setLastResult] = useState(null);
  const [processingState, setProcessingState] = useState('idle');
  const [errorMsg, setErrorMsg] = useState(null);
  const [logOffset, setLogOffset] = useState(0);

  const selectedVehicleRef = useRef(null);
  const handleAudioReadyRef = useRef(null);

  const recorder = useVoiceRecorder(useCallback((blob) => {
    if (handleAudioReadyRef.current) handleAudioReadyRef.current(blob);
  }, []));

  const loadLogs = useCallback(async (vehicle, reset = true) => {
    if (!vehicle) return;
    setLoadingLogs(true);
    const off = reset ? 0 : logOffset;
    try {
      const result = await fetchLogs({ vehicleId: vehicle.id, limit: 20, offset: off });
      setLogs(prev => reset ? result.logs : [...prev, ...result.logs]);
      setHasMore(result.hasMore);
      setLogOffset(off + result.logs.length);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoadingLogs(false);
    }
  }, [logOffset]);

  useEffect(() => {
    if (selectedVehicle) {
      selectedVehicleRef.current = selectedVehicle;
      setLogOffset(0);
      loadLogs(selectedVehicle, true);
    }
  }, [selectedVehicle?.id]);

  async function handleAudioReady(blob) {
    const vehicle = selectedVehicleRef.current;
    if (!vehicle) return;
    setErrorMsg(null);
    setLastResult(null);
    try {
      setProcessingState('transcribing');
      const transcript = await transcribeAudio(blob);
      setProcessingState('parsing');
      const result = await parseLog({
        transcript,
        vehicleId: vehicle.id,
        vehicleName: vehicle.name,
        currentMileage: vehicle.current_mileage,
      });
      setLastResult(result);
      if (result.parsed) {
        await loadLogs(vehicle, true);
        if (result.parsed.mileage && result.parsed.mileage > (vehicle.current_mileage || 0)) {
          const updated = { ...vehicle, current_mileage: result.parsed.mileage };
          onSelectVehicle(updated);
          selectedVehicleRef.current = updated;
          if (onVehiclesUpdated) {
            onVehiclesUpdated(prev => prev.map(v => v.id === vehicle.id ? updated : v));
          }
        }
      }
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setProcessingState('idle');
    }
  }

  handleAudioReadyRef.current = handleAudioReady;

  function getRecorderState() {
    if (processingState === 'transcribing') return 'processing';
    if (processingState === 'parsing') return 'parsing';
    if (lastResult && processingState === 'idle' && recorder.state === 'idle') return 'done';
    return recorder.state;
  }

  function handleLogEdited(updatedLog) {
    setLogs(prev => prev.map(l => l.id === updatedLog.id ? updatedLog : l));
    setEditingLog(null);
  }

  const uiState = getRecorderState();

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', maxWidth:'480px', margin:'0 auto', overflow:'hidden' }}>

      <div style={{ padding:'14px 0', flexShrink:0 }}>
        {vehicles.length > 0
          ? <VehiclePicker vehicles={vehicles} selected={selectedVehicle} onSelect={v => { onSelectVehicle(v); selectedVehicleRef.current = v; setLastResult(null); setLogOffset(0); }} />
          : <div style={{ padding:'0 16px', fontSize:'12px', color:'var(--text3)' }}>Loading vehicles...</div>}
      </div>

      <div style={{ padding:'8px 16px 24px', display:'flex', flexDirection:'column', alignItems:'center', gap:'16px', flexShrink:0 }}>
        <RecordButton
          recorderState={uiState}
          duration={recorder.duration}
          onStart={() => { setLastResult(null); setErrorMsg(null); recorder.start(); }}
          onStop={() => recorder.stop()}
          disabled={!selectedVehicle}
        />
        {(errorMsg || recorder.error) && (
          <div style={{ width:'100%', padding:'10px 14px', background:'#1a0a0a', border:'1px solid var(--red)', borderRadius:'var(--radius)', fontSize:'12px', color:'var(--red)' }}>
            {errorMsg || recorder.error}
          </div>
        )}
        {lastResult && !lastResult.needsReview && lastResult.parsed && (
          <div style={{ width:'100%', padding:'10px 14px', background:'#0a1a0a', border:'1px solid var(--green)', borderRadius:'var(--radius)', fontSize:'12px', color:'var(--green)' }}>
            ✓ Saved as {lastResult.logType} log{lastResult.parsed.mileage ? ` — ${lastResult.parsed.mileage.toLocaleString()} mi` : ''}
          </div>
        )}
      </div>

      {lastResult?.needsReview && lastResult?.parsed && (
        <div style={{ flexShrink:0, marginBottom:'12px' }}>
          <NeedsReviewBanner log={{ ...lastResult.parsed, logType: lastResult.logType }} onEdit={setEditingLog} />
        </div>
      )}

      <div style={{ flex:1, overflowY:'auto', padding:'0 16px 16px', display:'flex', flexDirection:'column', gap:'8px' }}>
        <div style={{ fontSize:'10px', color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', paddingBottom:'4px', borderBottom:'1px solid var(--border)', marginBottom:'4px', flexShrink:0 }}>
          Log History
        </div>
        {logs.length === 0 && !loadingLogs && (
          <div style={{ textAlign:'center', padding:'40px 0', fontSize:'13px', color:'var(--text3)' }}>
            No logs yet. Record your first entry above.
          </div>
        )}
        {logs.map(log => (
          <LogCard key={`${log.logType}-${log.id}`} log={log} onEdit={setEditingLog} />
        ))}
        {hasMore && (
          <button onClick={() => loadLogs(selectedVehicle, false)} disabled={loadingLogs}
            style={{ padding:'12px', background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--radius)', fontSize:'12px', color:'var(--text2)', letterSpacing:'0.05em' }}>
            {loadingLogs ? 'LOADING...' : 'LOAD MORE'}
          </button>
        )}
      </div>

      {editingLog && <EditModal log={editingLog} onClose={() => setEditingLog(null)} onSaved={handleLogEdited} />}
    </div>
  );
}
