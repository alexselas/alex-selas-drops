import { useState, useEffect, useCallback } from 'react';
import type { Track, CartItem } from '../types';

const CART_KEY = 'alex-selas-drops-cart';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useCart() {
  const [items, setItems] = useState<CartItem[]>(loadCart);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((track: Track) => {
    setItems(prev => {
      const exists = prev.find(i => i.track.id === track.id);
      if (exists) return prev; // digital goods — no duplicates
      return [...prev, { track, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((trackId: string) => {
    setItems(prev => prev.filter(i => i.track.id !== trackId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const isInCart = useCallback((trackId: string) => {
    return items.some(i => i.track.id === trackId);
  }, [items]);

  const total = items.reduce((sum, item) => sum + item.track.price, 0);
  const count = items.length;

  return {
    items,
    isOpen,
    setIsOpen,
    addItem,
    removeItem,
    clearCart,
    isInCart,
    total,
    count,
  };
}
