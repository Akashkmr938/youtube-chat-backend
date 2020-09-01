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

/**
 * Handling post call for URl and login details
 */
app.post("/streamData", (request, response) => {
  streamData = request.body;
  verify(streamData.loginDetails.id_token)
    .then((data) => {
      /* login data in data var. n */
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
    console.log(bodyObj);

    if (!bodyObj.items.length) {
      io.emit("error", "Internal Error Occurred");
    } else if (!bodyObj.items[0].liveStreamingDetails) {
      io.emit("error", "Invalid Live Stream URL");
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

  request({ url: chatURL, qs: requestProperties }, (body) => {
    const bodyObj = JSON.parse(body);

    if (bodyObj.items.length) {
      let chatItems = bodyObj.items;
      if (streamData.keywords.length) {
        chatItems = filterChat(chatItems, streamData.keywords);
      }

      io.emit("chatMessages", chatItems);

      chatItems.forEach((chat: any) => {
        console.log(
          `${chat.authorDetails.displayName} : ${chat.snippet.displayMessage}`
        );
      });
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
  return chats.filter((item: any) =>
    keywordInString(item.snippet.displayMessage.toLowerCase(), keywords)
  );
};

/**
 * Method to check if keyword is present in the chat string
 */
const keywordInString = (string: string, keywords: string[]) => {
  return string.split(/\b/).some(Array.prototype.includes.bind(keywords));
};

/**
 * Server running up
 */
server.listen(port, () => {
  console.log(`listening at port ${port}`);
});
