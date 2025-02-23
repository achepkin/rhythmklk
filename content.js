let clickerConfig = {
  x: null,
  y: null,
  interval: 6000, // Default 6 seconds
  isRunning: false,
  clickCount: 0,
  intervalId: null,
  debug: true, // Debug mode enabled by default
  pointSelected: false // Track if point has been selected
};

let lastKnownCoordinates = { x: 0, y: 0 };

// Track mouse movement
document.addEventListener('mousemove', (e) => {
  lastKnownCoordinates.x = e.clientX || e.pageX || e.x || lastKnownCoordinates.x;
  lastKnownCoordinates.y = e.clientY || e.pageY || e.y || lastKnownCoordinates.y;
});

// Debug logger
function debugLog(message, data = null) {
  if (clickerConfig.debug) {
    const timestamp = new Date().toISOString();
    const logMessage = `[AutoClicker ${timestamp}] ${message}`;
    
    if (data) {
      // Format the data to be more readable
      const formattedData = JSON.stringify(data, null, 2);
      console.log(logMessage + ':', formattedData);
    } else {
      console.log(logMessage);
    }
  }
}

// Validate coordinates
function isValidCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) && !Number.isNaN(value);
}

// Show visual feedback
function showFeedback(message, type = 'info') {
  const existingFeedback = document.getElementById('autoclicker-feedback');
  if (existingFeedback) {
    existingFeedback.remove();
  }

  const feedback = document.createElement('div');
  feedback.id = 'autoclicker-feedback';
  feedback.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 10px 20px;
    background-color: ${type === 'info' ? '#4CAF50' : '#f44336'};
    color: white;
    border-radius: 4px;
    z-index: 999999;
    font-family: Arial, sans-serif;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  `;
  feedback.textContent = message;
  document.body.appendChild(feedback);

  setTimeout(() => feedback.remove(), 3000);
}

// Handle point selection
function handlePointSelection(e) {
  // Prevent the default action and stop propagation
  e.preventDefault();
  e.stopPropagation();
  
  // Use coordinates from the event or last known position
  const x = e.clientX || e.pageX || e.x || lastKnownCoordinates.x;
  const y = e.clientY || e.pageY || e.y || lastKnownCoordinates.y;
  
  // Add more detailed logging
  debugLog('Click event received', {
    eventCoords: {
      clientX: e.clientX,
      clientY: e.clientY,
      pageX: e.pageX,
      pageY: e.pageY,
      x: e.x,
      y: e.y
    },
    lastKnownCoords: lastKnownCoordinates,
    finalCoords: { x, y },
    target: e.target.tagName,
    currentTarget: e.currentTarget.tagName,
    buttons: e.buttons,
    type: e.type
  });
  
  // Validate coordinates using last known position as fallback
  if (!isValidCoordinate(x) || !isValidCoordinate(y)) {
    debugLog('Invalid coordinates detected, using last known position', {
      lastKnownCoordinates,
      eventCoordinates: {
        clientX: e.clientX,
        clientY: e.clientY,
        pageX: e.pageX,
        pageY: e.pageY
      }
    });
    
    // If we don't even have valid last known coordinates, show error
    if (!isValidCoordinate(lastKnownCoordinates.x) || !isValidCoordinate(lastKnownCoordinates.y)) {
      showFeedback('Could not detect click position. Please try again.', 'error');
      return;
    }
  }
  
  // Store the validated coordinates
  clickerConfig.x = x;
  clickerConfig.y = y;
  clickerConfig.pointSelected = true;
  
  // Save coordinates
  chrome.storage.sync.set({ 
    clickerPoint: { 
      x: clickerConfig.x, 
      y: clickerConfig.y 
    } 
  });
  
  // Remove the click listener
  document.removeEventListener('click', handlePointSelection, true);
  
  // Log the selection
  debugLog('Click point selected', {
    coordinates: {
      x: clickerConfig.x,
      y: clickerConfig.y
    }
  });
  
  // Show visual feedback
  showFeedback('Click point selected!');
  
  // Notify popup about point selection
  chrome.runtime.sendMessage({ type: 'pointSelected' });
}

// Perform click at the selected point
function performClick() {
  if (!isValidCoordinate(clickerConfig.x) || !isValidCoordinate(clickerConfig.y)) {
    debugLog('Invalid click coordinates', {
      x: clickerConfig.x,
      y: clickerConfig.y
    });
    return;
  }
  
  try {
    // Create mouse events with more complete configuration
    const eventConfig = {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 1,
      screenX: clickerConfig.x,
      screenY: clickerConfig.y,
      clientX: clickerConfig.x,
      clientY: clickerConfig.y,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
      relatedTarget: null
    };

    // Create and dispatch events in sequence
    const events = [
      new MouseEvent('mousedown', eventConfig),
      new MouseEvent('mouseup', eventConfig),
      new MouseEvent('click', eventConfig)
    ];

    // Dispatch to both document and element at click coordinates
    events.forEach(event => {
      // Try to find the element at the click coordinates
      const element = document.elementFromPoint(clickerConfig.x, clickerConfig.y);
      if (element) {
        element.dispatchEvent(event);
      }
      // Also dispatch to document to ensure capture
      document.dispatchEvent(event);
    });
    
    clickerConfig.clickCount++;
    debugLog('Click performed at coordinates', {
      coordinates: {
        x: clickerConfig.x,
        y: clickerConfig.y
      },
      clickCount: clickerConfig.clickCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    debugLog('Click operation failed', {
      error: error.message,
      coordinates: {
        x: clickerConfig.x,
        y: clickerConfig.y
      },
      state: {
        isRunning: clickerConfig.isRunning,
        clickCount: clickerConfig.clickCount
      }
    });
  }
}

// Start auto clicker
function startClicker() {
  if (!clickerConfig.pointSelected) {
    showFeedback('Please select a click point first', 'error');
    debugLog('Start attempted without selected point');
    return;
  }

  if (clickerConfig.isRunning) {
    debugLog('Clicker is already running');
    return;
  }

  clickerConfig.isRunning = true;
  chrome.storage.sync.set({ isClicking: true });
  
  debugLog('Auto Clicker started', {
    interval: clickerConfig.interval,
    coordinates: { x: clickerConfig.x, y: clickerConfig.y }
  });
  showFeedback('Auto Clicker Started');
  
  performClick(); // Immediate first click
  clickerConfig.intervalId = setInterval(performClick, clickerConfig.interval);
}

// Stop auto clicker
function stopClicker() {
  if (!clickerConfig.isRunning) {
    debugLog('Clicker is not running');
    return;
  }

  clickerConfig.isRunning = false;
  chrome.storage.sync.set({ isClicking: false });
  
  debugLog('Auto Clicker stopped', {
    totalClicks: clickerConfig.clickCount,
    lastCoordinates: { x: clickerConfig.x, y: clickerConfig.y }
  });
  showFeedback('Auto Clicker Stopped');
  
  if (clickerConfig.intervalId) {
    clearInterval(clickerConfig.intervalId);
    clickerConfig.intervalId = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  debugLog('Message received', { type: message.type, data: message });
  
  switch (message.type) {
    case 'startSelection':
      if (message.shouldStopCurrent && clickerConfig.isRunning) {
        stopClicker();
      }
      debugLog('Starting point selection mode');
      document.addEventListener('click', handlePointSelection, true);
      break;
    case 'start':
      startClicker();
      break;
    case 'stop':
      stopClicker();
      break;
    case 'updateInterval':
      const oldInterval = clickerConfig.interval;
      clickerConfig.interval = message.interval * 1000;
      debugLog('Interval updated', {
        oldInterval: oldInterval,
        newInterval: clickerConfig.interval
      });
      if (clickerConfig.isRunning) {
        clearInterval(clickerConfig.intervalId);
        clickerConfig.intervalId = setInterval(performClick, clickerConfig.interval);
        debugLog('Interval timer reset with new value');
      }
      break;
    case 'setDebug':
      clickerConfig.debug = message.enabled;
      debugLog(`Debug mode ${message.enabled ? 'enabled' : 'disabled'}`);
      break;
  }
});

// Load saved configuration
chrome.storage.sync.get(['clickerPoint', 'clickInterval', 'debug'], (result) => {
  debugLog('Loading saved configuration', result);
  
  if (result.clickerPoint) {
    clickerConfig.x = result.clickerPoint.x;
    clickerConfig.y = result.clickerPoint.y;
    clickerConfig.pointSelected = true;
    debugLog('Restored click point', result.clickerPoint);
  }
  if (result.clickInterval) {
    clickerConfig.interval = result.clickInterval * 1000;
    debugLog('Restored interval', { interval: clickerConfig.interval });
  }
  if (typeof result.debug !== 'undefined') {
    clickerConfig.debug = result.debug;
    debugLog('Restored debug mode setting', { debug: clickerConfig.debug });
  }
});

// Ensure clicker stops when page unloads
window.addEventListener('beforeunload', () => {
  if (clickerConfig.isRunning) {
    stopClicker();
  }
}); 