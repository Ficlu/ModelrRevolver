const chatContainer = document.getElementById('chat-container');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

sendButton.addEventListener('click', sendMessage);

function sendMessage() {
  const message = messageInput.value;
  if (message.trim() !== '') {
    fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    })
      .then(() => {
        messageInput.value = '';
        fetchMessages();
        generateAIResponse(message);
      })
      .catch((error) => {
        console.error('Error sending message:', error);
      });
  }
}

function fetchMessages() {
  fetch('/api/chat')
    .then((response) => response.json())
    .then((messages) => {
      chatContainer.innerHTML = '';
      messages.forEach((message) => {
        const messageElement = document.createElement('p');
        messageElement.textContent = message.content;
        chatContainer.appendChild(messageElement);
      });
    })
    .catch((error) => {
      console.error('Error fetching messages:', error);
    });
}

async function generateAIResponse(message) {
  const apiKey = '';
  const apiUrl = 'https://api.anthropic.com/v1/complete';

  try {
    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
        // If the response is not okay, print out the text for debugging
        const errorText = await response.text();
        console.error('Error response text:', errorText);
        throw new Error(`Error from server: ${response.status} ${response.statusText}`);
      }
  
      const data = await response.json();
    const aiResponse = data.response;
    const responseElement = document.createElement('p');
    responseElement.textContent = `AI: ${aiResponse}`;
    chatContainer.appendChild(responseElement);
    console.log('AI response:', aiResponse);
  } catch (error) {
    console.error('Error generating AI response:', error);
  }
}

fetchMessages();