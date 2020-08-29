import express = require("express");
import request = require("request");
import http = require("http");
import socketIo = require("socket.io");

const apiKey = "AIzaSyDiO0j4AKF8__Uf5qqbvhjimr4kC8Q9t8c";

const port = process.env.PORT || 4001;

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

server.listen(port, () => {
  main();
});

const main = () => {
  getLiveChatId("kNLad-c1Srk", (liveChatId: string) => {
    console.log("liveChat id --->", liveChatId);

    if (liveChatId) {
      requestChatMessages("", liveChatId);
    }
  });
};

const requestChatMessages = (nextPageToken: any, liveChatId: string) => {
  const chatURL = "https://content.googleapis.com/youtube/v3/liveChat/messages";

  const requestProperties = {
    liveChatId: liveChatId,
    part: "snippet,id,authorDetails",
    key: apiKey,
    maxResults: 100,
    pageToken: nextPageToken,
  };

  request({ url: chatURL, qs: requestProperties }, (error, response, body) => {
    const bodyObj = JSON.parse(body);
    console.log(bodyObj);

    bodyObj.items.forEach((chat: any) => {
      console.log(
        `${chat.authorDetails.displayName} : ${chat.snippet.displayMessage}`
      );

      // setTimeout(() => {
      //   console.log("setTimeut here --->", bodyObj.pollingIntervalMillis);
      //   requestChatMessages(bodyObj.nextPageToken, liveChatId);
      // }, bodyObj.pollingIntervalMillis);
    });
  });
};

const getLiveChatId = (videoId: any, callback: any) => {
  const videoURL = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&key=${apiKey}&part=liveStreamingDetails,snippet`;

  request(videoURL, (error, request, body) => {
    var bodyObj = JSON.parse(body);
    console.log(bodyObj);

    callback(bodyObj.items[0].liveStreamingDetails.activeLiveChatId);
  });
};
