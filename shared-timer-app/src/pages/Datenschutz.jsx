import React from 'react';

const Datenschutz = () => (
  <div className="p-8 text-white max-w-4xl mx-auto leading-relaxed">
    <h1 className="text-3xl font-bold mb-6 glass-text">Datenschutzerklärung</h1>
    <h2 className="text-xl font-semibold mt-6 mb-2">1. Datenschutz auf einen Blick</h2>
    <p className="text-gray-300 mb-4">
      Wir behandeln Ihre personenbezogenen Daten vertraulich und entsprechend der 
      gesetzlichen Datenschutzvorschriften (DSGVO). Diese Seite wird auf einem 
      privaten Server in Deutschland gehostet.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">2. Datenerfassung auf diesem Server</h2>
    <p className="text-gray-400 mb-4 text-sm">
      Der Provider der Seiten erhebt und speichert automatisch Informationen in 
      Server-Log-Dateien (Browsertyp, Betriebssystem, Referrer URL, IP-Adresse, Uhrzeit). 
      Zudem speichern wir Spieldaten (Benutzername, Punkte, Zeitstempel) zur Bereitstellung 
      der Leaderboards. Es findet kein Tracking durch Drittanbieter statt.
    </p>
    <h2 className="text-xl font-semibold mt-6 mb-2">3. Ihre Rechte</h2>
    <p className="text-gray-300 mb-4">
      Sie haben jederzeit das Recht auf Auskunft, Berichtigung oder Löschung Ihrer Daten. 
      Wenden Sie sich hierzu an die im Impressum angegebene E-Mail-Adresse.
    </p>
  </div>
);

export default Datenschutz;
