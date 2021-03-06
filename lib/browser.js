var racer = require('racer');
var BCSocket = require('browserchannel/dist/bcsocket-uncompressed').BCSocket;

var CLIENT_OPTIONS =JSON.parse('{{clientOptions}}');

function Socket(options) {
  var self = this;

  self.messageQueue = [];
  self.connectedOnce = false;
  self.attemptNum = 0;

  var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

  self.url = protocol + '//' + window.location.host + CLIENT_OPTIONS.base;

  function createWebSocket () {
    self.type = 'websocket';

    self.socket = new WebSocket(self.url);
    self.readyState = 0;

    self.socket.onmessage = function(message) {
      self.readyState = self.socket.readyState;
      message.data = JSON.parse(message.data);
      self.onmessage && self.onmessage(message);
    }

    self.socket.onopen = function(event) {
      self.attemptNum = 0;

      self.readyState = self.socket.readyState;
      self.connectedOnce = true;

      self._flushQueue();
      self.onopen && self.onopen(event);
    }

    self.socket.onclose = function(event) {

      self.readyState = self.socket.readyState;
      console.log('WebSocket: connection is broken', event);
      self.onclose && self.onclose(event);

      if (!self.connectedOnce) {
        return createBrowserChannel();
      }

      if (options.reconnect) {
        setTimeout(function () {
          createWebSocket();
        }, (options.timeout || 10000) + (options.timeoutIncrement || 10000) * self.attemptNum);
      }
      self.attemptNum++;
    }
  }

  function createBrowserChannel () {
    self.type = 'browserchannel';
    self.socket = BCSocket(options.base, options);
    self.readyState = 0;

    self.socket.onmessage = function(data) {
      self.readyState = self.socket.readyState;
      self.onmessage && self.onmessage(data);
    }

    self.socket.onopen = function(event) {
      self.readyState = self.socket.readyState;
      self.onopen && self.onopen(event);
    }

    self.socket.onclose = function(event) {
      self.readyState = self.socket.readyState;
      self.onclose && self.onclose(event);
    }
  }

  // The condition is from Modernizr
  // https://github.com/Modernizr/Modernizr/blob/master/feature-detects/websockets.js#L28
  if ('WebSocket' in window && window.WebSocket.CLOSING === 2 && !options.browserChannelOnly) {
    createWebSocket();
  } else {
    createBrowserChannel();
  }
}

Socket.prototype._flushQueue = function(){
  while (this.messageQueue.length !== 0) {
    var data = this.messageQueue.shift();
    this._send(data);
  }
}

Socket.prototype._send = function(data){
  if (this.type === 'websocket' && (typeof data !== 'string')) data = JSON.stringify(data);

  this.socket.send(data);
}

Socket.prototype.send = function(data){
  if (this.type === 'websocket') {
    if (this.socket.readyState === WebSocket.OPEN && this.messageQueue.length === 0) {
      this._send(data);
    } else {
      this.messageQueue.push(data);
    }
  } else {
    this._send(data);
  }
}

Socket.prototype.close = function(){
  this.socket.close()
}

// ShareJs constants
Socket.prototype.canSendWhileConnecting = true;
Socket.prototype.canSendJSON = true;

// WebSocket constants
Socket.prototype.CONNECTING = 0;
Socket.prototype.OPEN = 1;
Socket.prototype.CLOSING = 2;
Socket.prototype.CLOSED = 3;


// Meybe need to use reconnection timing algorithm from
// http://blog.johnryding.com/post/78544969349/how-to-reconnect-web-sockets-in-a-realtime-web-app

racer.Model.prototype._createSocket = function(bundle) {
  return new Socket(CLIENT_OPTIONS);
};
