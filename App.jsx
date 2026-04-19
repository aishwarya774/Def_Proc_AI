import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Upload, Paperclip, Filter, Share2, ExternalLink, Plus, Settings, FileText, Trash2, Loader2, AlertCircle, CheckCircle2, MinusCircle, ChevronDown } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   HybridRAG UI — Ironclad Ledger Design System
   Production-ready React component wired to FastAPI backend.
   No mock data. All API calls are real.
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000'
  : `${window.location.protocol}//${window.location.hostname}:8000`;

const HybridRAGUI = () => {
  // ── State ─────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [documents, setDocuments] = useState([]);
  const [provider, setProvider] = useState('auto');
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sources, setSources] = useState([]);
  const [status, setStatus] = useState({
    ollama: 'checking',
    chromadb: 'checking',
    openai: 'checking',
    ollama_model: null,
    chromadb_chunks: 0,
  });

  const chatEndRef = useRef(null);
  const fileInputRef = useRef(null);

  // ── Auto-scroll chat ──────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Fetch system status on mount + interval ───────────────
  const fetchStatus = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/status`);
      if (resp.ok) {
        const data = await resp.json();
        setStatus({
          ollama: data.ollama || 'disconnected',
          chromadb: data.chromadb || 'disconnected',
          openai: data.openai || 'not_configured',
          ollama_model: data.ollama_model || data.default_model,
          chromadb_chunks: data.chromadb_chunks || 0,
        });
      }
    } catch {
      setStatus(prev => ({ ...prev, ollama: 'disconnected', chromadb: 'disconnected' }));
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // ── Fetch documents on mount ──────────────────────────────
  const fetchDocuments = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/api/documents`);
      if (resp.ok) {
        const data = await resp.json();
        setDocuments(data);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  // ── Send chat message ─────────────────────────────────────
  const handleSendMessage = async () => {
    const query = input.trim();
    if (!query || isLoading) return;

    const userMsg = {
      id: Date.now(),
      type: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, provider }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: 'Server error' }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      const assistantMsg = {
        id: Date.now() + 1,
        type: 'assistant',
        content: data.answer,
        provider: data.provider,
        model: data.model,
        routing_reason: data.routing_reason,
        sources: data.sources || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setSources(data.sources || []);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        type: 'error',
        content: `Error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── File upload ───────────────────────────────────────────
  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);

    for (const file of files) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        const resp = await fetch(`${API_BASE}/api/documents/upload`, {
          method: 'POST',
          body: formData,
        });
        if (resp.ok) {
          await fetchDocuments();
          fetchStatus();
        } else {
          const err = await resp.json().catch(() => ({}));
          alert(`Upload failed: ${err.detail || 'Unknown error'}`);
        }
      } catch (err) {
        alert(`Upload failed: ${err.message}`);
      }
    }
    setIsUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const handleDeleteDoc = async (filename) => {
    try {
      await fetch(`${API_BASE}/api/documents/${filename}`, { method: 'DELETE' });
      await fetchDocuments();
      fetchStatus();
    } catch { /* ignore */ }
  };

  // ── Status dot helper ─────────────────────────────────────
  const StatusDot = ({ state }) => {
    const colors = {
      connected: 'bg-emerald-500',
      ready: 'bg-emerald-500',
      configured: 'bg-amber-500',
      checking: 'bg-gray-400 animate-pulse',
      disconnected: 'bg-red-500',
      not_configured: 'bg-gray-400',
    };
    return <div className={`w-2 h-2 rounded-full ${colors[state] || 'bg-gray-400'}`} />;
  };

  const statusLabel = (state) => {
    const labels = {
      connected: 'Connected',
      ready: 'Ready',
      configured: 'Configured',
      checking: 'Checking...',
      disconnected: 'Disconnected',
      not_configured: 'Not Configured',
    };
    return labels[state] || state;
  };

  // ── New chat ──────────────────────────────────────────────
  const handleNewChat = () => {
    setMessages([]);
    setSources([]);
  };

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="flex h-screen bg-[#f8fafb] text-[#191c1e]"
         style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>

      {/* ============ LEFT SIDEBAR ============ */}
      <aside className="w-64 bg-white border-r border-[#c5c6ce]/30 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="p-5 border-b border-[#c5c6ce]/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#0b213e] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <div>
              <h1 className="font-bold text-sm text-[#0b213e] leading-tight"
                  style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}>
                HybridRAG
              </h1>
              <p className="text-[10px] text-[#75777e] font-medium uppercase tracking-wider">
                RAG Assistant v2.0
              </p>
            </div>
          </div>
        </div>

        {/* Documents + Upload */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {/* Upload Drop Zone */}
          <div
            className={`mb-4 border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer
              ${dragOver ? 'border-[#0b213e] bg-[#d5e3ff]/30' : 'border-[#c5c6ce]/50 hover:border-[#0b213e]/50'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.txt,.md"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            {isUploading ? (
              <Loader2 size={20} className="mx-auto text-[#0b213e] animate-spin" />
            ) : (
              <Upload size={20} className="mx-auto text-[#75777e] mb-1" />
            )}
            <p className="text-[10px] text-[#75777e] font-medium uppercase tracking-wider mt-1">
              {isUploading ? 'Uploading...' : 'Drop files here'}
            </p>
            <p className="text-[9px] text-[#75777e]/60 mt-0.5">PDF, DOCX, TXT, MD</p>
          </div>

          {/* Document List */}
          <h3 className="text-[11px] font-black text-[#0b213e] uppercase tracking-tight mb-3">
            Documents ({documents.length})
          </h3>
          <div className="space-y-2">
            {documents.length === 0 ? (
              <p className="text-[11px] text-[#75777e] italic">No documents uploaded</p>
            ) : (
              documents.map((doc, i) => (
                <div key={i}
                  className="p-3 bg-[#f2f4f6] rounded-lg hover:bg-[#e6e8ea] transition-colors group relative">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-5 h-5 bg-[#233655] rounded flex items-center justify-center flex-shrink-0">
                      <span className="text-[9px] text-white font-bold">
                        {(doc.type || 'F').charAt(0)}
                      </span>
                    </div>
                    <span className="text-[12px] font-medium text-[#0b213e] truncate flex-1">
                      {doc.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteDoc(doc.name); }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 size={12} className="text-red-500" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-[#75777e]">{doc.size_kb} KB</span>
                    <span className="text-[9px] text-[#75777e] uppercase">{doc.type}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* System Status */}
          <div className="mt-6 p-4 bg-[#f2f4f6] rounded-lg">
            <h4 className="text-[11px] font-black text-[#0b213e] uppercase tracking-tight mb-3">
              System Status
            </h4>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2">
                <StatusDot state={status.ollama} />
                <span>Ollama: <strong>{statusLabel(status.ollama)}</strong></span>
              </div>
              {status.ollama_model && (
                <p className="text-[9px] text-[#75777e] ml-4">Model: {status.ollama_model}</p>
              )}
              <div className="flex items-center gap-2">
                <StatusDot state={status.chromadb} />
                <span>ChromaDB: <strong>{statusLabel(status.chromadb)}</strong></span>
              </div>
              {status.chromadb_chunks > 0 && (
                <p className="text-[9px] text-[#75777e] ml-4">{status.chromadb_chunks} chunks indexed</p>
              )}
              <div className="flex items-center gap-2">
                <StatusDot state={status.openai} />
                <span>OpenAI: <strong>{statusLabel(status.openai)}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-[#c5c6ce]/30 p-4 space-y-2">
          <button
            onClick={handleNewChat}
            className="w-full py-3 bg-[#0b213e] text-white text-[11px] font-bold uppercase tracking-wider rounded-lg hover:bg-[#0f2d4a] transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            New Chat
          </button>
        </div>
      </aside>

      {/* ============ MAIN CONTENT ============ */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-[#c5c6ce]/30 px-8 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-[#0b213e]"
                style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}>
              HybridRAG Intelligence Chat
            </h2>
            <p className="text-[12px] text-[#75777e]">
              Smart routing between local & cloud models
              {status.ollama === 'connected' && status.ollama_model && (
                <span className="ml-2 text-emerald-600">● {status.ollama_model}</span>
              )}
            </p>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">

          {/* ──── Chat Pane ──── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
              {messages.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-[#0b213e]/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <FileText size={28} className="text-[#0b213e]/40" />
                    </div>
                    <h3 className="text-[#0b213e] font-bold text-sm mb-1"
                        style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}>
                      Ready to Query
                    </h3>
                    <p className="text-[12px] text-[#75777e] max-w-xs">
                      Upload documents and ask questions. Your data stays local with Ollama.
                    </p>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>

                  {message.type === 'assistant' ? (
                    <div className="max-w-2xl space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-[#1b2a41] rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">AI</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="bg-white rounded-lg p-4 border border-[#c5c6ce]/20 shadow-sm">
                            <p className="text-[14px] leading-relaxed text-[#191c1e] whitespace-pre-wrap">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px]">
                            <span className={`px-2 py-1 font-bold uppercase rounded ${
                              message.provider === 'ollama'
                                ? 'bg-[#d5e3ff] text-[#0b213e]'
                                : 'bg-[#d2eca2] text-[#131f00]'
                            }`}>
                              {message.provider === 'ollama'
                                ? `Local (${message.model || 'phi3:mini'})`
                                : `Cloud (${message.model || 'GPT-4o'})`}
                            </span>
                            {message.sources?.length > 0 && (
                              <span className="text-[#75777e]">
                                {message.sources.length} source{message.sources.length !== 1 ? 's' : ''}
                              </span>
                            )}
                            <span className="text-[#75777e]">{message.timestamp}</span>
                          </div>
                          {message.routing_reason && (
                            <p className="text-[10px] text-[#75777e] mt-1 italic">
                              {message.routing_reason}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : message.type === 'error' ? (
                    <div className="max-w-2xl">
                      <div className="bg-red-50 text-red-700 rounded-lg p-4 border border-red-200 flex items-start gap-2">
                        <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                        <p className="text-[13px]">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="max-w-2xl">
                      <div className="bg-[#05152b] text-white rounded-lg p-4">
                        <p className="text-[14px] leading-relaxed">{message.content}</p>
                      </div>
                      <div className="text-right mt-1 text-[11px] text-[#75777e]">
                        {message.timestamp}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-[#1b2a41] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">AI</span>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-[#c5c6ce]/20 shadow-sm">
                      <div className="flex items-center gap-2">
                        <Loader2 size={14} className="animate-spin text-[#0b213e]" />
                        <span className="text-[13px] text-[#75777e]">Thinking...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            {/* Input Area */}
            <div className="bg-white border-t border-[#c5c6ce]/30 px-8 py-5 flex-shrink-0">
              {/* Quick Actions */}
              <div className="mb-3 flex flex-wrap gap-2">
                {[
                  'Summarize all documents',
                  'Compare key findings',
                  'List main topics',
                ].map((action) => (
                  <button
                    key={action}
                    onClick={() => { setInput(action); }}
                    className="px-3 py-1.5 bg-[#d5e0f7] text-[#05152b] text-[10px] font-bold uppercase tracking-wider rounded-full hover:bg-[#c5d0e7] transition-all"
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="relative">
                <div className="bg-white rounded-xl border border-[#c5c6ce]/30 shadow-sm focus-within:border-[#0b213e]/40 transition-colors">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Ask HybridRAG about your documents..."
                    className="w-full bg-transparent border-none text-sm p-4 resize-none focus:outline-none"
                    rows="2"
                    disabled={isLoading}
                  />
                  <div className="flex justify-between items-center px-4 pb-3">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-[#75777e] hover:text-[#0b213e] transition-colors"
                    >
                      <Paperclip size={18} />
                    </button>
                    <button
                      onClick={handleSendMessage}
                      disabled={isLoading || !input.trim()}
                      className="bg-[#0b213e] text-white px-5 py-2 rounded-lg font-bold text-[11px] uppercase tracking-widest flex items-center gap-2 hover:bg-[#0f2d4a] transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : 'Execute Query'}
                      <Send size={14} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Provider Selector */}
              <div className="mt-3 flex items-center gap-2 text-[11px]">
                <span className="font-bold text-[#0b213e]">PROVIDER:</span>
                {['auto', 'local', 'cloud'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setProvider(p)}
                    className={`px-3 py-1 rounded uppercase font-bold text-[10px] transition-all ${
                      provider === p
                        ? 'bg-[#0b213e] text-white'
                        : 'bg-[#f2f4f6] text-[#75777e] hover:bg-[#e6e8ea]'
                    }`}
                  >
                    {p === 'auto' ? 'Auto' : p === 'local' ? 'Ollama' : 'OpenAI'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ──── RIGHT SIDEBAR: Sources ──── */}
          <div className="w-80 border-l border-[#c5c6ce]/30 bg-white flex flex-col flex-shrink-0">
            <div className="p-5 border-b border-[#c5c6ce]/30">
              <h3 className="text-sm font-black text-[#0b213e] uppercase tracking-tight"
                  style={{ fontFamily: "'Manrope', 'Inter', sans-serif" }}>
                Retrieved Sources
              </h3>
              <p className="text-[10px] text-[#75777e] font-bold uppercase tracking-widest mt-1">
                {sources.length} match{sources.length !== 1 ? 'es' : ''}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {sources.length === 0 ? (
                <div className="text-center py-8">
                  <FileText size={24} className="mx-auto text-[#c5c6ce] mb-2" />
                  <p className="text-[11px] text-[#75777e]">
                    Sources will appear here after you ask a question
                  </p>
                </div>
              ) : (
                sources.map((src, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 bg-[#233655] rounded flex items-center justify-center flex-shrink-0">
                        <span className="text-[9px] text-white font-bold">{i + 1}</span>
                      </div>
                      <span className="text-[11px] font-bold text-[#0b213e] truncate">
                        {src.source}
                      </span>
                      {i === 0 && (
                        <span className="text-[9px] font-bold bg-[#d2eca2] text-[#131f00] px-2 py-0.5 rounded uppercase ml-auto flex-shrink-0">
                          Primary
                        </span>
                      )}
                    </div>
                    <div className="p-3 bg-[#f2f4f6] border-l-2 border-[#d5e3ff] rounded-sm">
                      <p className="text-[11px] leading-relaxed text-[#191c1e]">
                        {src.snippet}
                      </p>
                      {src.page && (
                        <p className="text-[9px] font-bold text-[#75777e] uppercase mt-2 pt-2 border-t border-[#c5c6ce]/30">
                          Page {src.page}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default HybridRAGUI;
