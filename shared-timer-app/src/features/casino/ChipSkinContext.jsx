import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BUILT_IN_CHIP_SKINS, CHIP_VALUES, getChipImageFromCatalog } from './chipConfig';

const CHIP_SKIN_STORAGE_KEY = 'chipSkin';

const ChipSkinContext = createContext({
  skin: 'default',
  setSkin: () => {},
  availableSkins: BUILT_IN_CHIP_SKINS,
  loadingSkins: false,
  getSkinImage: () => null,
});

function normalizeManagedSkin(skin) {
  return {
    ...skin,
    id: skin.slug,
    label: skin.name,
    type: 'managed',
    builtIn: false,
    isBuiltIn: false,
  };
}

export function ChipSkinProvider({ children }) {
  const { token } = useAuth();
  const [skin, setSkinState] = useState(
    () => localStorage.getItem(CHIP_SKIN_STORAGE_KEY) || 'default'
  );
  const [managedSkins, setManagedSkins] = useState([]);
  const [managedAssetUrls, setManagedAssetUrls] = useState({});
  const [loadingSkins, setLoadingSkins] = useState(false);
  const [loadedToken, setLoadedToken] = useState(null);

  useEffect(() => {
    if (!token) {
      setManagedSkins([]);
      setManagedAssetUrls({});
      setLoadingSkins(false);
      setLoadedToken(null);
      return;
    }

    let cancelled = false;

    async function loadAvailableSkins() {
      setLoadingSkins(true);

      try {
        const { data } = await axios.get('/api/chip-skins/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!cancelled) {
          setManagedSkins((data.skins || []).map(normalizeManagedSkin));
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load chip skins:', err);
          setManagedSkins([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSkins(false);
          setLoadedToken(token);
        }
      }
    }

    loadAvailableSkins();

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    const objectUrls = [];

    async function loadManagedAssetUrls() {
      if (!token || managedSkins.length === 0) {
        setManagedAssetUrls({});
        return;
      }

      const nextAssetUrls = {};

      await Promise.all(managedSkins.flatMap((skinEntry) => {
        const values = Object.keys(skinEntry.assets || {}).length > 0
          ? Object.keys(skinEntry.assets).map(Number)
          : CHIP_VALUES;

        return values.map(async (value) => {
          try {
            const { data } = await axios.get(`/api/chip-skins/assets/${skinEntry.slug}/${value}.png`, {
              headers: { Authorization: `Bearer ${token}` },
              responseType: 'blob',
            });
            const objectUrl = URL.createObjectURL(data);
            objectUrls.push(objectUrl);
            nextAssetUrls[`${skinEntry.slug}:${value}`] = objectUrl;
          } catch (err) {
            if (!cancelled) {
              console.error(`Failed to load chip skin asset ${skinEntry.slug}/${value}:`, err);
            }
          }
        });
      }));

      if (!cancelled) {
        setManagedAssetUrls(nextAssetUrls);
      }
    }

    loadManagedAssetUrls();

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [managedSkins, token]);

  const availableSkins = useMemo(
    () => [
      ...BUILT_IN_CHIP_SKINS,
      ...managedSkins.map((skinEntry) => ({
        ...skinEntry,
        assets: Object.fromEntries(
          Object.entries(skinEntry.assets || {}).map(([value, asset]) => [
            value,
            {
              ...asset,
              url: managedAssetUrls[`${skinEntry.slug}:${value}`] || asset.url,
            },
          ])
        ),
      })),
    ],
    [managedAssetUrls, managedSkins]
  );

  useEffect(() => {
    if (loadingSkins) return;
    if (token && loadedToken !== token) return;

    const isAvailable = availableSkins.some(({ id }) => id === skin);
    if (!isAvailable) {
      setSkinState('default');
      localStorage.setItem(CHIP_SKIN_STORAGE_KEY, 'default');
    }
  }, [availableSkins, loadedToken, loadingSkins, skin, token]);

  const setSkin = useCallback((name) => {
    setSkinState(name);
    localStorage.setItem(CHIP_SKIN_STORAGE_KEY, name);
  }, []);

  const getSkinImage = useCallback((value, skinName = skin) => {
    const catalogSkin = availableSkins.find(({ id }) => id === skinName);
    if (!catalogSkin) return null;

    if (catalogSkin.builtIn) {
      return getChipImageFromCatalog(value, catalogSkin.id, availableSkins);
    }

    return managedAssetUrls[`${catalogSkin.slug}:${value}`]
      || getChipImageFromCatalog(value, catalogSkin.slug, availableSkins);
  }, [availableSkins, managedAssetUrls, skin]);

  const contextValue = useMemo(() => ({
    skin,
    setSkin,
    availableSkins,
    loadingSkins,
    getSkinImage,
  }), [availableSkins, getSkinImage, loadingSkins, setSkin, skin]);

  return (
    <ChipSkinContext.Provider value={contextValue}>
      {children}
    </ChipSkinContext.Provider>
  );
}

export function useChipSkin() {
  return useContext(ChipSkinContext);
}
