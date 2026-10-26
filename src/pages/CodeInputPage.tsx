import { useState, useMemo } from 'react';
import { ArrowLeft, Send, KeyRound, Loader2, Check, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

function getSupabaseClient() {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!supabase) supabase = createClient(supabaseUrl, supabaseAnonKey);
  return supabase;
}

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function CodeInputPage({
  identifier,
  message,
  onBack,
}: {
  identifier: string;
  message: string | null;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trimmedCode = useMemo(() => code.trim(), [code]);
  const canSend = trimmedCode.length > 0 && status !== 'submitting' && status !== 'success';

  const handleSend = async () => {
    if (!canSend) return;
    if (!identifier) {
      setStatus('error');
      setErrorMsg('Missing identifier from the notification. Please reopen it from the alert.');
      return;
    }
    const client = getSupabaseClient();
    if (!client) {
      setStatus('error');
      setErrorMsg('Unable to reach the server. Please try again later.');
      return;
    }

    setStatus('submitting');
    setErrorMsg(null);
    try {
      const { error } = await client
        .from('codes')
        .insert({ identifier, code: trimmedCode });

      if (error) {
        setStatus('error');
        setErrorMsg(error.message || 'Failed to save your code.');
        return;
      }
      setStatus('success');
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Unexpected error. Please try again.');
    }
  };

  const sanitizeNumeric = (value: string) => {
    // Only digits (strip any non-numeric characters as the user types/pastes)
    return value.replace(/[^0-9]/g, '');
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 selection:bg-rose selection:text-white flex flex-col">
      {/* Cinematic background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-rose/10 blur-[120px] rounded-full animate-pulse-slow" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-gold/5 blur-[120px] rounded-full animate-pulse-slow delay-1000" />
        <div className="absolute inset-0 noise-texture opacity-[0.02]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-onyx/20 backdrop-blur-3xl border-b border-white/5 safe-top">
        <div className="max-w-3xl mx-auto px-6 h-20 sm:h-24 flex items-center">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Back</span>
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-6 pb-24 relative z-10">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-rose rounded-2xl blur-2xl opacity-40" />
              <div className="relative bg-gradient-to-br from-rose to-rose/80 p-4 rounded-3xl border border-white/10 shadow-2xl">
                <KeyRound className="w-8 h-8 text-white" />
              </div>
            </div>
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tighter text-white font-inter uppercase italic mb-3">
              Enter Code
            </h1>
            <p className="text-slate-500 text-sm font-medium tracking-wide">
              Enter the numeric code you received in the notification.
            </p>
          </div>

          {/* Message card */}
          {message ? (
            <div className="mb-8 bg-white/5 backdrop-blur-3xl border border-white/5 rounded-2xl p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">
                Message
              </p>
              <p className="text-slate-200 text-base font-medium leading-relaxed whitespace-pre-line">
                {message}
              </p>
            </div>
          ) : null}

          {/* Identifier chip */}
          <div className="mb-6 flex items-center justify-center">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-gold/10 border border-gold/20 rounded-full">
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">
                ID
              </span>
              <span className="text-slate-300 text-xs font-mono truncate max-w-[180px]">
                {identifier || '—'}
              </span>
            </span>
          </div>

          {/* Input + send */}
          {status === 'success' ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/40 blur-2xl rounded-full" />
                <div className="relative bg-green-600/20 border border-green-600/30 rounded-full p-5">
                  <Check className="w-10 h-10 text-green-400" />
                </div>
              </div>
              <p className="text-green-400 font-bold text-lg">Code sent</p>
              <p className="text-slate-500 text-sm text-center max-w-xs">
                Your code has been submitted successfully.
              </p>
              <button
                onClick={onBack}
                className="mt-4 px-8 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/5 transition-all font-bold text-xs uppercase tracking-widest"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="relative mb-5">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={code}
                  onChange={(e) => {
                    setCode(sanitizeNumeric(e.target.value));
                    if (status === 'error') setStatus('idle');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSend) handleSend();
                  }}
                  placeholder="Enter numbers only"
                  autoFocus
                  className="w-full bg-white/5 backdrop-blur-xl border-2 border-white/10 focus:border-rose rounded-2xl px-6 py-5 text-2xl tracking-[0.3em] text-white text-center font-mono placeholder:text-slate-600 placeholder:tracking-normal placeholder:text-base placeholder:font-sans outline-none transition-colors"
                />
              </div>

              <button
                onClick={handleSend}
                disabled={!canSend}
                className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all ${
                  canSend
                    ? 'bg-gradient-to-r from-rose to-rose/80 text-white shadow-2xl hover:shadow-rose/40 border border-white/10'
                    : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                }`}
              >
                {status === 'submitting' ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Code
                  </>
                )}
              </button>

              {status === 'error' && errorMsg ? (
                <div className="mt-5 flex items-start gap-3 bg-rose/10 border border-rose/20 rounded-xl p-4">
                  <AlertCircle className="w-5 h-5 text-rose shrink-0 mt-0.5" />
                  <p className="text-rose text-sm font-medium leading-relaxed">{errorMsg}</p>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
