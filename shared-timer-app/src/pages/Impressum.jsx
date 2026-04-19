import React, { useState, useEffect } from 'react';
import { Info, Mail, FileText, ExternalLink, ShieldAlert } from 'lucide-react';

const ProtectedEmail = () => {
  const [email, setEmail] = useState('');
  
  useEffect(() => {
    // Simple obfuscation to prevent basic bot scraping
    const p1 = 'koalasync_admin';
    const p2 = 'koalamail.rocks';
    const timer = setTimeout(() => setEmail(`${p1}@${p2}`), 150);
    return () => clearTimeout(timer);
  }, []);

  if (!email) return <span className="animate-pulse text-gray-500 text-sm">E-Mail wird geladen...</span>;

  return (
    <a 
      href={`mailto:${email}`} 
      className="text-blue-400 hover:text-blue-300 transition-colors inline-flex items-center gap-2 font-medium"
    >
      <Mail size={16} />
      {email}
    </a>
  );
};

const Impressum = () => (
  <div className="p-4 md:p-8 text-white max-w-4xl mx-auto leading-relaxed animate-slide-up">
    <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <Info className="text-blue-400" size={32} />
        </div>
        <div>
            <h1 className="text-3xl md:text-4xl font-bold glass-text">Impressum</h1>
            <p className="text-gray-400 text-sm italic">Rechtliche Informationen zur Plattform</p>
        </div>
    </div>

    <div className="grid gap-6">
        <section className="glass-card-premium p-6 md:p-8">
            <div className="flex items-center gap-3 mb-4">
                <FileText className="text-blue-400" size={20} />
                <h2 className="text-xl font-semibold">Angaben gemäß § 5 TMG</h2>
            </div>
            <div className="space-y-4 text-gray-300">
                <div className="p-4 bg-black/20 rounded-lg border border-white/5">
                    <p className="font-bold text-white mb-1">Administrator KoalaSync</p>
                    <p className="text-sm opacity-80">Projekt: KoalaSync Gaming Plattform (Privatprojekt)</p>
                </div>
                
                <div className="flex flex-col gap-1">
                    <p className="text-xs uppercase tracking-wider text-gray-500 font-bold">Kontakt</p>
                    <ProtectedEmail />
                </div>
            </div>
        </section>

        <section className="glass-card-premium p-6 md:p-8 border-l-4 border-l-amber-500/50">
            <div className="flex items-center gap-3 mb-4">
                <ShieldAlert className="text-amber-400" size={20} />
                <h2 className="text-xl font-semibold">Haftungsausschluss</h2>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed">
                Diese Website dient ausschließlich privaten Test- und Bildungszwecken. 
                Die Inhalte wurden mit größter Sorgfalt erstellt, jedoch kann keine Gewähr 
                für die Richtigkeit, Vollständigkeit oder Aktualität der bereitgestellten 
                Informationen übernommen werden. Externe Links wurden zum Zeitpunkt der 
                Verlinkung geprüft, für deren Inhalt sind jedoch ausschließlich deren 
                Betreiber verantwortlich.
            </p>
        </section>
        
        <div className="text-center pt-4 opacity-30 pointer-events-none">
            <p className="text-xs uppercase tracking-[0.2em]">KoalaSync Global Infrastructure</p>
        </div>
    </div>
  </div>
);

export default Impressum;
