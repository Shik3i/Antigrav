import React from 'react';
import { Shield, Lock, Database, UserCheck, Globe, Scale } from 'lucide-react';

const Datenschutz = () => (
  <div className="p-4 md:p-8 text-white max-w-4xl mx-auto leading-relaxed animate-slide-up">
    <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
            <Lock className="text-green-400" size={32} />
        </div>
        <div>
            <h1 className="text-3xl md:text-4xl font-bold glass-text">Datenschutzerklärung</h1>
            <p className="text-gray-400 text-sm italic">Informationen zum Schutz Ihrer persönlichen Daten</p>
        </div>
    </div>

    <div className="grid gap-6">
        <section className="glass-card-premium p-6">
            <div className="flex items-center gap-3 mb-4">
                <Shield className="text-green-400" size={20} />
                <h2 className="text-xl font-semibold">1. Datenschutz auf einen Blick</h2>
            </div>
            <p className="text-gray-300 mb-4 opacity-90">
                Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der 
                gesetzlichen Datenschutzvorschriften (DSGVO). Diese Seite wird auf einem 
                privaten Server in Deutschland gehostet, um maximale Souveränität über die 
                Daten zu gewährleisten.
            </p>
        </section>

        <section className="glass-card-premium p-6">
            <div className="flex items-center gap-3 mb-4">
                <Database className="text-green-400" size={20} />
                <h2 className="text-xl font-semibold">2. Datenerfassung auf diesem Server</h2>
            </div>
            <div className="space-y-4">
                <div className="p-4 bg-black/20 rounded-lg border border-white/5 text-sm text-gray-400">
                    <p className="mb-2 uppercase text-[10px] font-bold tracking-widest text-gray-500">Server-Logs</p>
                    Der Provider erhebt Informationen in Server-Log-Dateien: Browsertyp, Betriebssystem, Referrer URL, IP-Adresse, Uhrzeit des Zugriffs.
                </div>
                <div className="p-4 bg-black/20 rounded-lg border border-white/5 text-sm text-gray-400">
                    <p className="mb-2 uppercase text-[10px] font-bold tracking-widest text-gray-500">Spieldaten</p>
                    Wir speichern Benutzernamen, Punkte und Zeitstempel zur Bereitstellung der Leaderboards & Achievements.
                </div>
                <p className="text-xs text-gray-500 italic mt-2 flex items-center gap-2">
                    <Globe size={12} /> Kein Tracking durch Drittanbieter (Google Analytics, Facebook etc.).
                </p>
            </div>
        </section>

        <section className="glass-card-premium p-6">
            <div className="flex items-center gap-3 mb-4">
                <UserCheck className="text-green-400" size={20} />
                <h2 className="text-xl font-semibold">3. Ihre Rechte</h2>
            </div>
            <p className="text-gray-300 opacity-90">
                Sie haben jederzeit das Recht auf Auskunft, Berichtigung oder Löschung Ihrer Daten. 
                Sollten Sie eine Löschung Ihres Accounts oder Ihrer Spieldaten wünschen, 
                wenden Sie sich bitte an die im Impressum angegebene E-Mail-Adresse.
            </p>
        </section>
        
        <div className="flex items-center justify-center gap-2 py-6 opacity-40">
            <Scale size={16} />
            <span className="text-xs font-medium uppercase tracking-widest">DSGVO Konformität gewährleistet</span>
        </div>
    </div>
  </div>
);

export default Datenschutz;
