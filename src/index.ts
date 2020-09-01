import express from "express";
import request from "request";
import http from "http";
import socketIo from "socket.io";
import { OAuth2Client } from "google-auth-library";
import cors from "cors";
import * as dotenv from "dotenv";

dotenv.config();

const client = new OAuth2Client(process.env.CLIENT_ID);
const port = process.env.PORT || 4001;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(cors());

let streamData: any;
let timer: any;
let counter = 0;

/**
 * Handling post call for URl and login details
 */
app.post("/streamData", (request, response) => {
  streamData = request.body;
  counter = 0;
  verify(streamData.loginDetails.id_token)
    .then((data) => {
      getLiveChatId(streamData.url, (liveChatId: string) => {
        if (liveChatId) {
          requestChatMessages("", liveChatId);
        }
      });
      response.send({
        error: false,
        message: "success",
      });
    })
    .catch((error) => {
      console.log("login error", error);
      response.status(401).send({
        error: true,
        message: "Login token not valid",
      });
    });
});

/**
 * Google token authentication
 */
const verify = async (token: string) => {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: process.env.CLIENT_ID,
  });
  return ticket.getPayload();
};

/**
 * Method to get the live chat id of the URL
 */
const getLiveChatId = (videoId: any, callback: any) => {
  const videoURL = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${process.env.API_KEY}&part=liveStreamingDetails,snippet`;
  request(videoURL, (error, response, body) => {
    var bodyObj = JSON.parse(body);

    if (!bodyObj.items.length) {
      io.emit("error", "Internal Error Occurred");
      return io.emit("closeSocket");
    }
    if (!bodyObj.items[0].liveStreamingDetails) {
      io.emit("error", "Invalid Live Stream URL");
      return io.emit("closeSocket");
    }
    if (!bodyObj.items[0].liveStreamingDetails.activeLiveChatId) {
      io.emit("error", "Chat not available for this stream");
      return io.emit("closeSocket");
    } else {
      callback(bodyObj.items[0].liveStreamingDetails.activeLiveChatId);
    }
  });
};

/**
 * Socket connection
 */
io.on("connection", (socket) => {
  socket.on("closeConnection", () => {
    console.log("Close connection");
    socket.disconnect();
    clearInterval(timer);
  });
});
/**
 * Chat request with polling
 */
const requestChatMessages = (nextPageToken: string, liveChatId: string) => {
  const chatURL = "https://content.googleapis.com/youtube/v3/liveChat/messages";
  const requestProperties = {
    liveChatId: liveChatId,
    part: "snippet,id,authorDetails",
    key: process.env.API_KEY,
    maxResults: 100,
    pageToken: nextPageToken,
  };

  request({ url: chatURL, qs: requestProperties }, (error, request, body) => {
    const bodyObj = JSON.parse(body);
    let chatItems = [];
    counter++;

    if (bodyObj.error && bodyObj.error.message) {
      io.emit("error", bodyObj.error.message);
      return io.emit("closeSocket");
    }

    if (bodyObj.items.length) {
      chatItems = bodyObj.items;
      if (streamData.keywords.length) {
        chatItems = filterChat(chatItems, streamData.keywords);
      }

      if (chatItems.length) {
        io.emit("chatMessages", chatItems);
      }

      chatItems.forEach((chat: any) => {
        console.log(
          `${chat.authorDetails.displayName} : ${chat.snippet.displayMessage}`
        );
      });
    }
    if (!chatItems.length && counter === 1) {
      io.emit("error", "No chats to display");
      return io.emit("closeSocket");
    }

    timer = setTimeout(() => {
      requestChatMessages(bodyObj.nextPageToken, liveChatId);
    }, bodyObj.pollingIntervalMillis);
  });
};

/**
 * Filtering chat based on keywords
 */
const filterChat = (chats: any, keywords: string[]) => {
  keywords = keywords.map((keyword) => keyword.toLowerCase());

  console.log("keywords", keywords);

  return chats.filter((item: any) =>
    keywordInString(item.snippet.displayMessage.toLowerCase(), keywords)
  );
};

/**
 * Method to check if keyword is present in the chat string
 */
const keywordInString = (string: string, keywords: string[]) => {
  var r = false;
  string.split(/\b/).some((x) => {
    return (r = keywords.includes(x) ? true : false);
  });
  return r;
};

/**
 * Get call for testing
 */
app.get("/", (request, response) => response.send("Server is up and running"));

/**
 * Server running up
 */
server.listen(port, () => {
  console.log(`listening at port ${port}`);
});
