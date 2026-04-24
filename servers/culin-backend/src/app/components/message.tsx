import React from "react";
import ReactMarkdown from "react-markdown";

type MessageProps = {
  message: {
    id: number;
    text: string;
    role: "user" | "assistant" | "error";
  };
};

const MessageBubble: React.FC<MessageProps> = ({ message }) => {
  return (
    <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg p-4 ${
          message.role === "user"
            ? "bg-indigo-600 text-white"
            : message.role === "error"
            ? "bg-red-50 border-2 border-red-300 text-red-800"
            : "bg-white border border-gray-200 text-gray-800"
        }`}
      >
        <ReactMarkdown>{message.text}</ReactMarkdown>
      </div>
    </div>
  );
};

export default MessageBubble;
