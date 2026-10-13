

async function connectWallet() {
  try {
    // Open wallet selection modal.
    const provider = await web3Modal.connect();

    // Create an instance of ethers.js using the provided
    const ethersProvider = new ethers.providers.Web3Provider(provider);

    // Get signer
    const signer = ethersProvider.getSigner();

    // You can now use this in your app to check wallet details and send transactions
    const address = await signer.getAddress();
    console.log("Connected address:", address);

  } catch (error) {
    console.error("Could not get a wallet connection", error);
  }
}


const socket = window.dracoriaAuthenticated ? io() : null;

document.addEventListener('DOMContentLoaded', function () {
  if(!window.dracoriaAuthenticated)return;
  const updateStatus = async () => {
    try {

      updateGarden();
      updateDragon();
      updateUser();

    } catch (error) {
      console.error('Error fetching status:', error);
      //alert('Failed to fetch status. Please try again.');
    }
  };

  updateStatus();
});

function updateUser() {
  fetch('/api/user/status')
    .then(response => response.json())
    .then(data => {
      document.getElementById('lavaJuiceCount').textContent = `Lava Juice: ${data.lavaJuice}`;
    })
    .catch((error) => {
      console.error('Error fetching user data:', error);
      //alert('Error fetching user data. Please try again.');
    });
}

socket?.on('dragonUpdate', (data) => {
  console.log('Dragon update received', data);
  // Update dragon state on the web page
  document.getElementById('dragonHunger').textContent = `Hunger: ${data.hunger}`;
  document.getElementById('dragonHappiness').textContent = `Happiness: ${data.happiness}`;
});

socket?.on('gardenUpdate', (data) => {
  console.log('Garden update received', data);
  // Update garden state on the web page
  document.getElementById('fruitCount').textContent = `Fruit Count: ${data.fruitCount}`;
});

socket?.on('connect_error', (err) => {
  // Handle connection error
  console.error('WebSocket connection error. Try refreshing the page.', err);
  //alert('WebSocket connection error. Try refreshing the page.');
});