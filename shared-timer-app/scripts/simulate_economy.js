const dbLayer = require('../database');

async function simulate() {
    console.log("\n========================================");
    console.log("   KOALA ECONOMY MATHEMATICS PROOF");
    console.log("========================================\n");
    
    // 1. Fetch current baseline settings
    const settings = await dbLayer.getKoalaBaseline();
    const hourlyKC = settings.koala_points_per_hour / 100;
    const multiplier = settings.koala_daily_mission_multiplier;
    
    console.log(`[SETTINGS]`);
    console.log(`- Hourly Baseline: ${settings.koala_points_per_hour} Cents (${hourlyKC} KC)`);
    console.log(`- Mission Multiplier: ${multiplier}x`);
    console.log("");
    
    // 2. Prove 1-hour focus session
    const durationMinutes = 60;
    const sessionEarnings = Math.floor((durationMinutes / 60) * settings.koala_points_per_hour);
    console.log(`[TEST: 1-HOUR FOCUS SESSION]`);
    console.log(`- Duration: ${durationMinutes} minutes`);
    console.log(`- Math: (${durationMinutes}/60) * ${settings.koala_points_per_hour}`);
    console.log(`- Result: ${sessionEarnings} Cents (${(sessionEarnings / 100).toFixed(2)} KC)`);
    console.log(sessionEarnings === 1000 ? "✅ SUCCESS: Exactly 10.00 KC awarded." : "❌ ERROR: Calculation mismatch.");
    console.log("");
    
    // 3. Prove Daily Mission
    const missionReward = Math.floor(settings.koala_points_per_hour * multiplier);
    console.log(`[TEST: DAILY MISSION]`);
    console.log(`- Multiplier: ${multiplier}x`);
    console.log(`- Math: ${settings.koala_points_per_hour} * ${multiplier}`);
    console.log(`- Result: ${missionReward} Cents (${(missionReward / 100).toFixed(2)} KC)`);
    console.log(missionReward === 1000 ? "✅ SUCCESS: Exactly 10.00 KC (1.0x baseline) awarded." : "❌ ERROR: Calculation mismatch.");
    console.log("");

    console.log("========================================\n");
    process.exit(0);
}

simulate().catch(err => {
    console.error("SIMULATION ERROR:", err);
    process.exit(1);
});
