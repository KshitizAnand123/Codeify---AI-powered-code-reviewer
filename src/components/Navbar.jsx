import React from 'react'
import { BrainCircuit } from 'lucide-react';

const Navbar = () => {
  return (
    <div
      className="nav flex items-center justify-between h-[90px] bg-zinc-900"
      style={{ padding: "0px 150px" }}
    >
      <div className="logo flex items-center gap-[10px]">
        <BrainCircuit size={30} color="#9333ea" />
        <span className="text-2xl font-bold text-white ml-2">
          Codeify
        </span>
      </div>
    </div>
  );
};

export default Navbar;
