import React from 'react';
import { Shield, Lock, Database, UserCheck, Globe, Scale, Eye, HardDrive, Cpu, AlertCircle } from 'lucide-react';

const PrivacyBadge = ({ icon: Icon, label, color = "blue" }) => (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border border-${color}-500/20 bg-${color}-500/5 text-${color}-400 text-[10px] uppercase font-bold tracking-widest`}>
        <Icon size={12} />
        {label}
    </div>
);

const Datenschutz = () => (
    <div className="p-4 md:p-12 text-white max-w-6xl mx-auto min-h-screen animate-slide-up">
        {/* Hero Section */}
        <header className="relative mb-16 flex flex-col items-center text-center">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-green-500/10 blur-[100px] pointer-events-none rounded-full" />
            <div className="p-5 bg-green-500/10 rounded-2xl border border-green-500/20 shadow-2xl mb-6 relative">
                <Lock className="text-green-400 animate-glow" size={48} />
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tight glass-text mb-4">
                DATENSCHUTZ
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl leading-relaxed">
                Ihre Privatsphäre ist das Fundament unserer <span className="text-green-400 font-bold">digitalen Souveränität</span>.
            </p>
            
            <div className="flex flex-wrap justify-center gap-3 mt-8">
                <PrivacyBadge icon={Globe} label="Private Hosting" color="green" />
                <PrivacyBadge icon={Eye} label="Zero Tracking" color="green" />
                <PrivacyBadge icon={Shield} label="GDPR Compliant" color="green" />
            </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8 flex flex-col gap-8">
                {/* Section 1 */}
                <section className="glass-card-premium p-8 group relative">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-1 bg-green-500 rounded-full" />
                        <h2 className="text-2xl font-bold uppercase tracking-widest">Grundprinzipien</h2>
                    </div>
                    <p className="text-gray-300 leading-relaxed mb-6">
                        Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der gesetzlichen Datenschutzvorschriften (DSGVO). 
                        Im Gegensatz zu gängigen Plattformen nutzen wir <span className="text-white font-medium">keine externen Tracking-Dienste</span> oder Werbecookies von Drittanbietern.
                    </p>
                    <div className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-start gap-4">
                        <AlertCircle className="text-green-400 mt-1 shrink-0" size={20} />
                        <p className="text-sm text-green-300/80 italic">
                            Alle Daten verbleiben auf privat administrierten Servern in Deutschland. Wir haben die volle physische und digitale Kontrolle über Ihre Informationen.
                        </p>
                    </div>
                </section>

                {/* Section 2 */}
                <section className="glass-card-premium p-8">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="w-10 h-1 bg-green-500 rounded-full" />
                        <h2 className="text-2xl font-bold uppercase tracking-widest">Datenerfassung</h2>
                    </div>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-3 text-gray-200">
                                <Cpu size={20} className="text-green-400" />
                                <h3 className="font-bold uppercase tracking-wider text-xs">Server-Infrastruktur</h3>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Automatische Erfassung technischer Daten in Log-Files: Browsertyp, Betriebssystem, IP-Adresse (anonymisiert), Referrer URL. Diese werden nach 14 Tagen automatisch bereinigt.
                            </p>
                        </div>

                        <div className="p-6 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                            <div className="flex items-center gap-3 text-gray-200">
                                <Database size={20} className="text-green-400" />
                                <h3 className="font-bold uppercase tracking-wider text-xs">Anwendungsdaten</h3>
                            </div>
                            <p className="text-xs text-gray-500 leading-relaxed">
                                Speicherung von Benutzernamen, Achievements und Highscores zur Bereitstellung der Kernfunktionalität. Diese Daten sind für andere Nutzer der Plattform sichtbar.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Section 3 */}
                <section className="glass-card-premium p-8 border-l-4 border-l-green-500/30">
                    <div className="flex items-center gap-4 mb-6">
                        <UserCheck className="text-green-400" size={24} />
                        <h2 className="text-xl font-bold">Nutzerrechte</h2>
                    </div>
                    <ul className="space-y-4">
                        {[
                            { title: "Auskunftsrecht", desc: "Sie können jederzeit anfragen, welche Daten wir über Sie gespeichert haben." },
                            { title: "Recht auf Löschung", desc: "Ein formloser Antrag per E-Mail genügt, um Ihr Profil und alle Spieldaten permanent zu entfernen." },
                            { title: "Datenübertragbarkeit", desc: "Wir stellen Ihnen Ihre Daten auf Wunsch in einem maschinenlesbaren Format bereit." }
                        ].map((item, i) => (
                            <li key={i} className="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors">
                                <span className="flex-center w-6 h-6 rounded bg-green-500/20 text-green-400 text-[10px] font-bold">{i+1}</span>
                                <div>
                                    <h4 className="text-sm font-bold text-white mb-1">{item.title}</h4>
                                    <p className="text-xs text-gray-400">{item.desc}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            </div>

            <aside className="lg:col-span-4 flex flex-col gap-6">
                <div className="glass-card p-8 border border-white/10 relative overflow-hidden">
                    <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
                        <Shield size={120} />
                    </div>
                    <h4 className="text-xs font-black uppercase tracking-[0.2em] text-green-400 mb-6">Security Architecture</h4>
                    <div className="space-y-6">
                        <div className="flex items-start gap-3">
                            <Lock size={16} className="text-green-500 mt-1 shrink-0" />
                            <div>
                                <p className="text-xs font-bold mb-1">SSL/TLS Verschlüsselung</p>
                                <p className="text-[10px] text-gray-500">Ihre Verbindung ist nach Industriestandards gesichert.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <HardDrive size={16} className="text-green-500 mt-1 shrink-0" />
                            <div>
                                <p className="text-xs font-bold mb-1">Encrypted Database</p>
                                <p className="text-[10px] text-gray-500">Sensible Daten werden verschlüsselt in SQLite3 abgelegt.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-card-premium p-6 text-center border-green-500/20">
                     <Scale className="mx-auto mb-3 text-green-400 opacity-50" size={32} />
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-loose">
                         Entwickelt für <br/> Datenschutz-Puristen
                     </p>
                </div>
            </aside>
        </main>
        
        <footer className="mt-16 text-center opacity-20 text-[10px] uppercase font-bold tracking-[0.5em]">
            KoalaSync Privacy Layer v1.2
        </footer>
    </div>
);

export default Datenschutz;
