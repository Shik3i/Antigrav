import { createContext, useContext, useState } from 'react';

const ChipSkinContext = createContext({ skin: 'default', setSkin: () => {} });

export function ChipSkinProvider({ children }) {
  const [skin, setSkinState] = useState(
    () => localStorage.getItem('chipSkin') || 'default'
  );

  function setSkin(name) {
    setSkinState(name);
    localStorage.setItem('chipSkin', name);
  }

  return (
    <ChipSkinContext.Provider value={{ skin, setSkin }}>
      {children}
    </ChipSkinContext.Provider>
  );
}

export function useChipSkin() {
  return useContext(ChipSkinContext);
}
