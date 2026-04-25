import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import { useWS } from '../services/ws';
import { useToast } from './Toast';
import { Settings as SettingsApi } from '../services/api';

/**
 * App-wide listener for Steam Guard prompts. Whenever SteamCMD prompts for a
 * 2FA code (during a server install or workshop download), a modal pops up
 * here so the user can submit the code without leaving the page they're on.
 */
export default function SteamGuardListener() {
  const { subscribe } = useWS();
  const toast = useToast();
  const [prompt, setPrompt] = useState(null);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return subscribe((msg) => {
      if (msg.type !== 'steam:progress') return;
      if (msg.data?.kind === 'steam-guard-required') {
        setPrompt({ kind: msg.data.guardKind || 'email', message: msg.data.message });
      }
    });
  }, [subscribe]);

  async function submit() {
    if (!code.trim()) {
      toast.error('Enter the Steam Guard code first.');
      return;
    }
    setSubmitting(true);
    try {
      await SettingsApi.submitGuard(code.trim());
      toast.info('Code submitted.');
      setPrompt(null);
      setCode('');
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Failed to submit code');
    } finally {
      setSubmitting(false);
    }
  }

  if (!prompt) return null;
  return (
    <Modal
      open
      title={prompt.kind === 'mobile' ? 'Steam Mobile Authenticator code' : 'Steam Guard code'}
      onClose={() => setPrompt(null)}
    >
      <p className="text-sm text-ink-200 mb-3">
        {prompt.kind === 'mobile'
          ? 'Open the Steam mobile app and enter the 5-character code shown there.'
          : 'Steam emailed you a code. Check your inbox (and spam) and enter it here.'}
      </p>
      <input
        className="input"
        autoFocus
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder={prompt.kind === 'mobile' ? 'XXXXX' : 'ABCDE'}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
      />
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn-ghost" onClick={() => setPrompt(null)}>Cancel</button>
        <button className="btn-primary" disabled={submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Submit code'}
        </button>
      </div>
    </Modal>
  );
}
