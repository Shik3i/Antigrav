import React, { useState, useEffect, useCallback } from 'react';
import { Info, Mail, FileText, ExternalLink, ShieldAlert, Copy, Check, Fingerprint, Globe, User, ShieldCheck } from 'lucide-react';

const ProtectedEmail = () => {
    const [hidden, setHidden] = useState(true);
    const [email, setEmail] = useState('');
    const [copied, setCopied] = useState(false);

    const revealEmail = useCallback(() => {
        if (!hidden) return;
        const p1 = 'koalasync_admin';
        const p2 = 'koalamail.rocks';
        setEmail(`${p1}@${p2}`);
        setHidden(false);
    }, [hidden]);

    const copyToClipboard = async (e) => {
        e.stopPropagation();
        if (hidden) return;
        try {
            await navigator.clipboard.writeText(email);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) { }
    };

    return (
        <div 
            onClick={revealEmail}
            className={`group relative overflow-hidden transition-all duration-500 cursor-pointer ${
                hidden 
                ? 'bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 px-4 py-3' 
                : 'bg-white/5 border-white/10 px-4 py-4 pr-12'
            } border rounded-2xl flex items-center justify-between min-w-[280px] max-w-md shadow-xl`}
        >
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${hidden ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'} transition-colors duration-500`}>
                    {hidden ? <ShieldCheck size={18} /> : <Mail size={18} />}
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-0.5">Offizieller Kontakt</span>
                    {hidden ? (
                        <span className="text-sm font-medium text-blue-300/80 italic">Klicken zum Entschlüsseln...</span>
                    ) : (
                        <span className="text-sm font-bold text-white tracking-wide animate-fade-in">{email}</span>
                    )}
                </div>
            </div>

            {!hidden && (
                <button 
                    onClick={copyToClipboard}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                    title="In Zwischenablage kopieren"
                >
                    {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
            )}

            {hidden && (
                <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-blue-500/10 to-transparent flex items-center justify-center">
                    <Fingerprint size={16} className="text-blue-400/40 animate-pulse" />
                </div>
            )}
        </div>
    );
};

const Impressum = () => (
    <div className="p-4 md:p-12 text-white max-w-6xl mx-auto min-h-screen animate-slide-up">
        {/* Immersive Header */}
        <header className="relative mb-12 flex flex-col items-center text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-500/20 blur-[100px] pointer-events-none rounded-full" />
            <div className="p-5 bg-blue-500/10 rounded-2xl border border-blue-500/20 shadow-2xl mb-6 relative">
                <Info className="text-blue-400 animate-glow" size={48} />
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight glass-text mb-4">
                IMPRESSUM
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
                Transparenz und rechtliche Identifikation der <span className="text-blue-400 font-bold">KoalaSync Gaming Plattform</span>.
            </p>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Main Info Card */}
            <div className="lg:col-span-8 flex flex-col gap-8">
                <section className="glass-card-premium p-8 md:p-10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 group-hover:rotate-0 transition-transform duration-700 pointer-events-none">
                        <User size={160} />
                    </div>
                    
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-1 bg-blue-500 rounded-full" />
                        <h2 className="text-2xl font-bold tracking-tight uppercase tracking-[0.1em]">Betreiber Information</h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-10">
                        <div className="space-y-6">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Projektleitung</span>
                                <p className="text-xl font-bold text-white">Administrator KoalaSync</p>
                                <p className="text-gray-400 text-sm italic">Privatprojekt zur Echtzeit-Synchronisation</p>
                            </div>

                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Inhaltlich Verantwortlich</span>
                                <p className="text-md font-semibold text-gray-200">Administrator KoalaSync</p>
                                <p className="text-xs text-gray-500 leading-tight">(gemäß § 55 Abs. 2 RStV)</p>
                            </div>
                        </div>

                        <div className="flex flex-col gap-6">
                            <ProtectedEmail />
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 opacity-60">
                                <Globe className="text-gray-400" size={20} />
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase font-bold text-gray-500">Host Standort</span>
                                    <span className="text-xs font-bold">Deutschland, EU</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="glass-card-premium p-8 border-l-4 border-l-amber-500/30">
                    <div className="flex items-center gap-3 mb-6">
                        <ShieldAlert className="text-amber-500" size={24} />
                        <h3 className="text-xl font-bold">Haftung für Inhalte</h3>
                    </div>
                    <div className="text-sm leading-relaxed text-gray-400 space-y-4">
                        <p>
                            Als Diensteanbieter sind wir gemäß § 7 Abs.1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen.
                        </p>
                        <p>
                            Die Inhalte dieses Projekts dienen ausschließlich <span className="text-white font-medium underline decoration-amber-500/30 decoration-2">Test- und Bildungszwecken</span> im privaten Rahmen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
                        </p>
                    </div>
                </section>
            </div>

            {/* Sidebar Meta */}
            <div className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-card p-6 border border-white/10 bg-gradient-to-br from-white/5 to-transparent">
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-blue-400 mb-4">Plattform Status</h4>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-gray-400">Version</span>
                            <span className="text-xs font-mono font-bold px-2 py-1 bg-white/10 rounded">v2.39.0</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-white/5">
                            <span className="text-xs text-gray-400">Lizenz</span>
                            <span className="text-xs font-bold text-gray-200">Privat / Educational</span>
                        </div>
                        <div className="flex justify-between items-center py-2">
                            <span className="text-xs text-gray-400">Sync Engine</span>
                            <span className="text-xs font-bold text-green-400 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> Node-Live
                            </span>
                        </div>
                    </div>
                </div>

                <div className="text-center p-8 opacity-20 hover:opacity-100 transition-opacity duration-1000">
                    <Fingerprint className="mx-auto mb-4" size={40} />
                    <p className="text-[10px] uppercase font-bold tracking-[0.3em]">KoalaSync Digital Identity</p>
                </div>
            </div>
        </main>
    </div>
);

export default Impressum;
