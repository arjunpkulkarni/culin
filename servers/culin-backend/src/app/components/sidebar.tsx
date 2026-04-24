import React from "react";
import { GiCookingPot } from "react-icons/gi";

const Sidebar: React.FC = () => {  

  return (
    <div className="flex flex-col border-gray-200 bg-white border-r w-72 h-screen shadow-lg">
      <div className="border-gray-200 p-6">
        <div className="flex items-center gap-3">
          <GiCookingPot className="text-indigo-600" size={32} />
          <h1 className="font-bold text-gray-800 text-2xl">CulinAI</h1>
        </div>
        <p className="text-sm text-gray-500 mt-2">Your personal culinary assistant</p>
      </div>      
    </div>
  );
};

export default Sidebar;
