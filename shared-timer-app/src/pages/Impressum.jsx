import React from 'react';

const Impressum = () => (
  <div className="p-8 text-white max-w-4xl mx-auto leading-relaxed">
    <h1 className="text-3xl font-bold mb-6 glass-text">Impressum</h1>
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-2">Angaben gemäß § 5 TMG</h2>
      <p className="text-gray-300">
        Administrator KoalaSync<br />
        Projekt: KoalaSync Gaming Plattform (Privatprojekt)<br />
        E-Mail: <span className="text-blue-400">koalasync_admin@koalamail.rocks</span>
      </p>
    </section>
    <section className="mb-8">
      <h2 className="text-xl font-semibold mb-2">Haftungsausschluss</h2>
      <p className="text-gray-400 text-sm">
        Diese Website dient ausschließlich privaten Test- und Bildungszwecken. 
        Die Inhalte wurden mit größter Sorgfalt erstellt, jedoch kann keine Gewähr 
        für die Richtigkeit oder Vollständigkeit übernommen werden.
      </p>
    </section>
  </div>
);

export default Impressum;
