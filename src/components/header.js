import React from 'react';

export default function Header() {
  return (
    <header className="bg-blue-500 text-white  p-4">
        <div className='flex'>
        <img src="http://www.mumresults.in/images/University-logo321.png" className='w-48' ></img>
      <div className="container mx-auto my-auto text-center">
        <h1 className="text-2xl font-bold">Dispatch Data</h1>
      </div>
      </div>
    </header>
  );
}
