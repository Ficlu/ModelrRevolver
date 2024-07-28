import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [systemMessages, setSystemMessages] = useState([]);
  const [newSystemMessage, setNewSystemMessage] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-4-turbo');
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatThreads, setChatThreads] = useState([]);
  const [chatName, setChatName] = useState('');
  const [isEditingChatName, setIsEditingChatName] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [responseTokenLength, setResponseTokenLength] = useState(100);
  const [temperature, setTemperature] = useState(1);
  const [maxTemperature, setMaxTemperature] = useState(1);
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [useAnthropicEnvVariable, setUseAnthropicEnvVariable] = useState(true);
  const [useOpenaiEnvVariable, setUseOpenaiEnvVariable] = useState(true);
  const resizeBoundaryRef = useRef(null);
  const chatWrapperRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [chatContainerHeight, setChatContainerHeight] = useState(0);
  const [uploadedImage, setUploadedImage] = useState(null);
  const models = [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307',
    'gpt-4-turbo',
    'gpt-4-turbo-preview',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo',
  ];

  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    if (selectedModel.startsWith('gpt-')) {
      setMaxTemperature(2);
    } else {
      setMaxTemperature(1);
      setTemperature(1);
    }
  }, [selectedModel]);

  useEffect(() => {
    calculateTokenCount();
  }, [messages, selectedModel]);

  const fetchChats = () => {
    fetch('/api/chats')
      .then((response) => response.json())
      .then((chats) => {
        setChatThreads(chats);
        if (chats.length > 0) {
          setSelectedChat(chats[0]);
          fetchMessages(chats[0].smid);
        } else {
          setSelectedChat(null);
          setMessages([]);
        }
      })
      .catch((error) => {
        console.error('Error fetching chats:', error);
      });

    fetch('/api/saved-system-messages')
      .then((response) => response.json())
      .then((savedSystemMessages) => {
        setSystemMessages(savedSystemMessages);
      })
      .catch((error) => {
        console.error('Error fetching saved system messages:', error);
      });
  };

  const fetchMessages = (chatId) => {
    fetch(`/api/messages?chatId=${chatId}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then((messages) => {
        const updatedMessages = messages.map((message) => ({
          ...message,
          isPlaying: false,
        }));
        setMessages(updatedMessages);
      })
      .catch((error) => {
        console.error('Error fetching messages:', error);
      });
  };

  const sendMessage = () => {
    if (messageInput.trim() !== '' || uploadedImage) {
      let base64Image = null;
      const processMessage = () => {
        fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: messageInput,
            chatId: selectedChat.smid.toString(),
            base64Image: base64Image,
          }),
        })
          .then(() => {
            setMessageInput('');
            setUploadedImage(null);
            fetchMessages(selectedChat.smid);
            generateAIResponse(messageInput);
          })
          .catch((error) => {
            console.error('Error sending message:', error);
          });
      };
  
      if (uploadedImage) {
        const reader = new FileReader();
        reader.onloadend = () => {
          base64Image = reader.result.split(',')[1];
          processMessage();
        };
        reader.readAsDataURL(uploadedImage);
      } else {
        processMessage();
      }
    }
  };

  const resetMessageInputHeight = () => {
    const messageInput = document.getElementById('message-input');
    messageInput.style.height = '75px';
  };

  const generateAIResponse = (message) => {
    setIsLoading(true);
    let requestBody;
    if ((selectedModel === 'gpt-4-turbo' || selectedModel.startsWith('claude-')) && uploadedImage) {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Image = reader.result; // Use the full result without splitting
            requestBody = {
                message,
                model: selectedModel,
                chatId: selectedChat ? selectedChat.smid.toString() : null,
                responseTokenLength,
                temperature,
                base64Image, // This now includes the MIME type and encoding info
                useAnthropicEnvVariable,
                anthropicApiKey,
                useOpenaiEnvVariable,
                openaiApiKey,
            };
  
            fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            })
            .then((response) => response.json())
            .then((data) => {
                console.log('AI response:', data.response);
                fetchMessages(selectedChat.smid);
                setIsLoading(false);
                setUploadedImage(null);
            })
            .catch((error) => {
                console.error('Error generating AI response:', error);
                setIsLoading(false);
                setUploadedImage(null);
            });
        };
        reader.readAsDataURL(uploadedImage);
    } else {
        requestBody = {
            message,
            model: selectedModel,
            chatId: selectedChat ? selectedChat.smid.toString() : null,
            responseTokenLength,
            temperature,
            useAnthropicEnvVariable,
            anthropicApiKey,
            useOpenaiEnvVariable,
            openaiApiKey,
        };
  
        fetch('/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        })
        .then((response) => response.json())
        .then((data) => {
            console.log('AI response:', data.response);
            fetchMessages(selectedChat.smid);
            setIsLoading(false);
        })
        .catch((error) => {
            console.error('Error generating AI response:', error);
            setIsLoading(false);
        });
    }
};


  const deleteMessage = (messageId) => {
    fetch(`/api/messages/${messageId}`, {
      method: 'DELETE',
    })
      .then(() => {
        fetchMessages(selectedChat.smid);
      })
      .catch((error) => {
        console.error('Error deleting message:', error);
      });
  };

  const calculateTokenCount = () => {
    fetch('/api/token-count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, model: selectedModel }),
    })
      .then((response) => response.json())
      .then((data) => {
        const tokenCount = data.tokenCount;
        setTokenCount(tokenCount);
      })
      .catch((error) => {
        console.error('Error calculating token count:', error);
      });
  };
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    setUploadedImage(file);
  };
  const handleDeleteChat = () => {
    if (selectedChat) {
      fetch(`/api/chats/${selectedChat.smid}`, {
        method: 'DELETE',
      })
        .then(() => {
          fetchChats();
          setSelectedChat(null);
          setMessages([]);
        })
        .catch((error) => {
          console.error('Error deleting chat:', error);
        });
    }
  };

  const saveApiKeys = () => {
    fetch('/api/api-keys', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        anthropicApiKey,
        openaiApiKey,
        useAnthropicEnvVariable,
        useOpenaiEnvVariable,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        console.log('API keys saved successfully');
      })
      .catch((error) => {
        console.error('Error saving API keys:', error);
      });
  };

  const handleDeleteSystemMessage = () => {
    if (newSystemMessage.trim() !== '') {
      fetch(`/api/system-message/${selectedChat.smid}`, {
        method: 'DELETE',
      })
        .then(() => {
          setNewSystemMessage('');
          fetchChats();
        })
        .catch((error) => {
          console.error('Error deleting system message:', error);
        });
    }
  };

  const handleRenameChatClick = () => {
    setIsEditingChatName(true);
  };

  const handleChatNameChange = (e) => {
    setChatName(e.target.value);
  };

  const handleSaveChatName = () => {
    if (selectedChat && chatName.trim() !== '') {
      fetch(`/api/chats/${selectedChat.smid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: chatName }),
      })
        .then(() => {
          setIsEditingChatName(false);
          fetchChats();
        })
        .catch((error) => {
          console.error('Error renaming chat:', error);
        });
    }
  };

  const handleNewSystemMessageChange = (e) => {
    setNewSystemMessage(e.target.value);
  };

  const adjustTextareaHeight = (textarea) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  const saveSystemMessage = () => {
    if (newSystemMessage.trim() !== '') {
      fetch('/api/system-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ systemMessage: newSystemMessage, chatId: selectedChat.smid.toString() }),
      })
        .then(() => {
          console.log('System message saved');
          setNewSystemMessage('');
          fetchChats();
        })
        .catch((error) => {
          console.error('Error saving system message:', error);
        });
    }
  };

  const handleChatThreadChange = (e) => {
    const selectedChatId = BigInt(e.target.value);
    const selectedChat = chatThreads.find((chat) => chat.smid === selectedChatId);
    setSelectedChat(selectedChat);
    setChatName(selectedChat ? selectedChat.name || `Chat ${selectedChat.smid}` : '');
    fetchMessages(selectedChatId);
    calculateTokenCount();
  };

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
  };

  const adjustMessageInputHeight = (textarea) => {
    // Calculate the max height in viewport height (VH) unit
    const maxHeightVH = ((window.innerHeight - textarea.getBoundingClientRect().top - 82) / window.innerHeight) * 100;
    textarea.style.height = 'auto';
    const newHeightVH = Math.min((textarea.scrollHeight / window.innerHeight) * 100, maxHeightVH);
    const currentHeightVH = (textarea.clientHeight / window.innerHeight) * 100;
    textarea.style.height = `${Math.max(newHeightVH, currentHeightVH)}vh`;
  
    // Adjust overflow based on whether the new content is larger than the max height permitted.
    if ((textarea.scrollHeight / window.innerHeight) * 100 > maxHeightVH) {
      textarea.style.overflowY = 'scroll';
    } else {
      textarea.style.overflowY = 'auto';
    }
  
    // Adjust the height of the chat container
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.querySelector('.user-input');
    const resizeBoundary = document.querySelector('.resize-boundary');
    const chatWrapper = document.getElementById('chat-wrapper');
    const chatWrapperHeight = chatWrapper.offsetHeight;
    const resizeBoundaryHeight = resizeBoundary.offsetHeight;
    const newUserInputHeight = userInput.offsetHeight;
    const minChatContainerHeight = 8; // Minimum height of chat container (17px)
    const maxChatContainerHeight = chatWrapperHeight - resizeBoundaryHeight - minChatContainerHeight - 82; // Subtract additional padding/margin
    const newChatContainerHeight = Math.min(maxChatContainerHeight, chatWrapperHeight - newUserInputHeight - resizeBoundaryHeight - minChatContainerHeight);
    chatContainer.style.height = `${newChatContainerHeight}px`;
  
    // Adjust the overflow of the chat container
    if (newChatContainerHeight === maxChatContainerHeight) {
      chatContainer.style.overflowY = 'auto';
    } else {
      chatContainer.style.overflowY = 'hidden';
    }
  };
  const playTTS = (text, messageId, existingAudioUrl) => {
    console.log('playTTS - text:', text);
    console.log('playTTS - messageId:', messageId);
    console.log('playTTS - existingAudioUrl:', existingAudioUrl);
    // turns other messages off 
    setMessages((prevMessages) =>
      prevMessages.map((message) => ({
        ...message,
        isPlaying: message.id === messageId ? true : false,
      }))
    );
    if (existingAudioUrl) {
      console.log('playTTS - Existing audio URL found, updating message state');
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === messageId ? { ...message, isLoading: false } : message
        )
      );
    } else {
      console.log('playTTS - No existing audio URL, sending request to generate audio');
      fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model: 'tts-1',
          voice: 'shimmer',
          messageId: messageId,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          const audioUrl = data.audioUrl;
          console.log('playTTS - Received audio URL:', audioUrl);
          setMessages((prevMessages) =>
            prevMessages.map((message) =>
              message.id === messageId ? { ...message, audioUrl, isLoading: false } : message
            )
          );
        })
        .catch((error) => {
          console.error('playTTS - Error playing TTS:', error);
          setMessages((prevMessages) =>
            prevMessages.map((message) =>
              message.id === messageId ? { ...message, isLoading: false } : message
            )
          );
        });
    }
  };

  const AudioPlayer = ({ audioUrl, messageId }) => {
    const audioRef = useRef(null);
    useEffect(() => {
      const message = messages.find((m) => m.id === messageId);
      if (message) {
        if (message.isPlaying && !audioRef.current.paused) {
          audioRef.current.play();
        } else if (!message.isPlaying && !audioRef.current.paused) {
          audioRef.current.pause();
        }
      }
    }, [messages, messageId]);
    const handleAudioEnded = () => {
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === messageId ? { ...message, isPlaying: false } : message
        )
      );
    };
    const handleAudioPause = () => {
      setMessages((prevMessages) =>
        prevMessages.map((message) =>
          message.id === messageId ? { ...message, isPlaying: false } : message
        )
      );
    };
    return (
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        onEnded={handleAudioEnded}
        onPause={handleAudioPause}
      >
        Your browser does not support the audio element.
      </audio>
    );
  };

  const handleNewChat = () => {
    fetch('/api/chats', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ systemMessage: '' }),
    })
      .then((response) => response.json())
      .then((newChat) => {
        setSelectedChat(newChat);
        setMessages([]);
        setChatThreads((prevChatThreads) => [...prevChatThreads, newChat]);
      })
      .catch((error) => {
        console.error('Error creating new chat:', error.message);
      });
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
  
    const chatWrapper = chatWrapperRef.current;
    const resizeBoundary = resizeBoundaryRef.current;
    const chatContainer = document.getElementById('chat-container');
    const userInput = document.querySelector('.user-input');
    const messageInput = document.getElementById('message-input');
  
    const chatWrapperRect = chatWrapper.getBoundingClientRect();
    const resizeBoundaryRect = resizeBoundary.getBoundingClientRect();
    const chatContainerRect = chatContainer.getBoundingClientRect();
    const userInputRect = userInput.getBoundingClientRect();
  
    const minChatContainerHeight = 24;
    const maxChatContainerHeight = 82;
    const minUserInputHeight = 32 / chatWrapperRect.height * 100;
    const maxUserInputHeight = (chatWrapperRect.height - 64) / chatWrapperRect.height * 100;
  
    const resizerLocation = (e.clientY - chatWrapperRect.top) / chatWrapperRect.height * 100;
  
    if (resizerLocation <= 88) {
      const newChatContainerHeight = Math.min(
        Math.max(resizerLocation, minChatContainerHeight),
        maxChatContainerHeight
      );
  
      if (newChatContainerHeight >= minChatContainerHeight && newChatContainerHeight <= maxChatContainerHeight) {
        chatContainer.style.height = `${newChatContainerHeight}vh`;
        // Update the chatContainerHeight state variable
        setChatContainerHeight(newChatContainerHeight);
      }
  
      const newUserInputHeight =
        (chatWrapperRect.height - resizeBoundaryRect.height - newChatContainerHeight * chatWrapperRect.height / 100) /
        chatWrapperRect.height *
        100;
  
      if (newUserInputHeight >= minUserInputHeight && newUserInputHeight <= maxUserInputHeight) {
        userInput.style.height = `${newUserInputHeight}vh`;
        messageInput.style.height = `${newUserInputHeight - 2}vh`;
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div className="chat-shell">
      <div className="title-container">
        <div id="spacer"></div>
        <div className="title-animation">
          <h1>Model Revolver</h1>
        </div>
        <div id="spacer"></div>
      </div>
      <div id="chat-user-wrapper">
        <div id="chat-container-wrapper">
          <div id="lSidePanel" className="sidePanel">
            <div id="lSidePanelContentWrapper">
              <div className="chat-thread-wrapper">
                <h3>Chat Threads</h3>
                {isEditingChatName ? (
                  <div>
                    <input
                      type="text"
                      value={chatName}
                      onChange={handleChatNameChange}
                    />
                    <button onClick={handleSaveChatName}>Save</button>
                  </div>
                ) : (
                  <div>
                    <select
                      className="panelSelect"
                      id="chat-thread-select"
                      value={selectedChat ? selectedChat.smid : ''}
                      onChange={handleChatThreadChange}
                    >
                      {chatThreads.map((chat) => (
                        <option key={chat.smid} value={chat.smid}>
                          {chat.name || `Chat ${chat.smid}`}
                        </option>
                      ))}
                    </select>
                    <button onClick={handleRenameChatClick}>Rename</button>
                    <button onClick={handleDeleteChat}>Delete</button>
                  </div>
                )}
                <button id="new-chat-button" onClick={handleNewChat}>
                  + New
                </button>
              </div>
              <div className="model-wrapper">
                <h3>Model Selection</h3>
                <select
                  className="panelSelect"
                  id="model-select"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                >
                  {models.map((model, index) => (
                    <option key={index} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </div>
              <div className="response-token-length-wrapper">
                <h3>Response Token Length</h3>
                <input
                  type="range"
                  min="1"
                  max="4000"
                  value={responseTokenLength}
                  onChange={(e) => setResponseTokenLength(Number(e.target.value))}
                />
                <span>{responseTokenLength}</span>
              </div>
              <div className="temperature-wrapper">
                <h3>Temperature</h3>
                <input
                  type="range"
                  min="0"
                  max={maxTemperature}
                  step="0.01"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                />
                <span>{temperature}</span>
              </div>
              <div className="system-message-wrapper">
                <h3>System Message</h3>
                <div>
                  <select
                    className="panelSelect"
                    id="system-message-select"
                    value={newSystemMessage}
                    onChange={handleNewSystemMessageChange}
                  >
                    <option value="">Select a saved system message</option>
                    {systemMessages.map((message) => (
                      <option key={message.id} value={message.content}>
                        {message.content.slice(0, 50)}...
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  id="system-message-input"
                  placeholder="Enter a system prompt..."
                  value={newSystemMessage}
                  onChange={handleNewSystemMessageChange}
                  onInput={(e) => adjustTextareaHeight(e.target)}
                  rows={4}
                />
                <button id="save-system-message-button" onClick={saveSystemMessage}>
                  Save
                </button>
                <button id="delete-system-message-button" onClick={handleDeleteSystemMessage}>
                  Delete
                </button>
              </div>
            </div>
          </div>
          <div id="chat-wrapper" ref={chatWrapperRef}>
            <div
              id="chat-container"
              style={{
                borderImage: isLoading
                  ? 'conic-gradient(from var(--angle), red, yellow, lime, aqua, blue, magenta, red) 1'
                  : 'none',
                animation: isLoading ? 'rotate 6.3s cubic-bezier(0.43, -0.35, 0, 1.3) .1s infinite both' : 'none',
                borderImageSlice: '1 fill',
              }}
            >
              {messages.map((message, index) => (

                <div
                  key={index}
                  className={`message ${message.role}-message ${
                    message.isPlaying ? 'playing' : 'paused'
                  }`}
                >
                  <strong>{message.role === 'user' ? 'You' : 'AI'}:</strong>
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                  {message.image_url && (
                    <img src={message.image_url} alt="Uploaded" className="message-image" />
                  )}
                  <div className="messageButtonWrapper">
                    {message.audioUrl ? (
                      <AudioPlayer audioUrl={message.audioUrl} messageId={message.id} />
                    ) : (
                      <button className="speech-button" onClick={() => playTTS(message.content, message.id, message.audioUrl)} disabled={message.isLoading}>
                        {message.isLoading ? (
                          'Loading...'
                        ) : (
                          <span className="material-symbols-outlined">text_to_speech</span>
                        )}
                      </button>
                    )}
                    <button className="delete-button" onClick={() => deleteMessage(message.id)}>
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div
              ref={resizeBoundaryRef}
              className="resize-boundary"
              onMouseDown={handleMouseDown}
            />
            <div className="user-input">
              <textarea
                id="message-input"
                placeholder="Enter your message here..."
                value={messageInput}
                onChange={handleMessageInputChange}
                rows={3}
              />
              <button className="panel-button" id="send-button" onClick={sendMessage}>
                Send
              </button>
             
{(selectedModel === 'gpt-4-turbo' || selectedModel.startsWith('claude-')) && (
  <div className="image-upload-wrapper">
    <input type="file" accept="image/*" onChange={handleImageUpload} />
  </div>
)}

            </div>
          </div>
          <div id="rSidePanel" className="sidePanel">
            <h3>Token Count</h3>
            <p>{tokenCount}</p>
            <h3>API Keys</h3>
            <div className="keyEntryWrapper">
              <div className="keyEntry">
                <label htmlFor="anthropicApiKey">Anthropic</label>
                <input
                  type="password"
                  id="anthropicApiKey"
                  value={anthropicApiKey}
                  onChange={(e) => setAnthropicApiKey(e.target.value)}
                />
                <label className="envVarCheck" htmlFor="useAnthropicEnvVariable">Use env variables?</label>
                <input
                  type="checkbox"
                  id="useAnthropicEnvVariable"
                  checked={useAnthropicEnvVariable}
                  onChange={(e) => setUseAnthropicEnvVariable(e.target.checked)}
                />
              </div>
              <div className="keyEntry">
                <label htmlFor="openaiApiKey">OpenAI</label>
                <input
                  type="password"
                  id="openaiApiKey"
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                />
                <label className="envVarCheck" htmlFor="useOpenaiEnvVariable">Use env variables?</label>
                <input
                  type="checkbox"
                  id="useOpenaiEnvVariable"
                  checked={useOpenaiEnvVariable}
                  onChange={(e) => setUseOpenaiEnvVariable(e.target.checked)}
                />
              </div>
            </div>
            <button onClick={saveApiKeys}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;