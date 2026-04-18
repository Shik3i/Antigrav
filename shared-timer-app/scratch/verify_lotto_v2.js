const axios = require('axios');

async function testLottoValidation() {
  console.log('Testing Lotto Validation...');
  try {
    // We don't have a valid token here in terminal usually, 
    // but the error should happen at validation level before DB.
    // However, the controller middleware might block us.
    // Let's try to hit the endpoint with invalid data and see the response.
    
    const testTickets = [
      { numbers: [1.5, 2, 3, 4, 5, 6], superzahl: 0 }
    ];

    try {
      await axios.post('http://localhost:3001/api/lotto/buy', { tickets: testTickets });
    } catch (err) {
      console.log('Validation Response (Integer Numbers):', err.response?.data?.message);
    }

    const testTicketsSZ = [
      { numbers: [1, 2, 3, 4, 5, 6], superzahl: 3.7 }
    ];

    try {
      await axios.post('http://localhost:3001/api/lotto/buy', { tickets: testTicketsSZ });
    } catch (err) {
      console.log('Validation Response (Integer Superzahl):', err.response?.data?.message);
    }

  } catch (error) {
    console.error('Test Failed:', error.message);
  }
}

testLottoValidation();
