import { useRef, useCallback, useState } from "react";

/**
 * タッチ操作でのドラッグ＆ドロップを実現するカスタムフック
 * ロングプレス（300ms）でドラッグ開始、指移動でドラッグ、指離しでドロップ
 */
interface UseTouchDnDOptions {
  onReorder: (fromIndex: number, toIndex: number) => void;
  longPressDelay?: number;
}

interface TouchDnDState {
  isDragging: boolean;
  dragIndex: number | null;
  overIndex: number | null;
}

export function useTouchDnD({ onReorder, longPressDelay = 300 }: UseTouchDnDOptions) {
  const [state, setState] = useState<TouchDnDState>({
    isDragging: false,
    dragIndex: null,
    overIndex: null,
  });

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());
  const ghostRef = useRef<HTMLElement | null>(null);
  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const clearAutoScroll = useCallback(() => {
    if (scrollInterval.current) {
      clearInterval(scrollInterval.current);
      scrollInterval.current = null;
    }
  }, []);

  const createGhost = useCallback((element: HTMLElement, x: number, y: number) => {
    const rect = element.getBoundingClientRect();
    const ghost = element.cloneNode(true) as HTMLElement;
    ghost.style.position = "fixed";
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.opacity = "0.85";
    ghost.style.transform = "scale(1.03)";
    ghost.style.zIndex = "9999";
    ghost.style.pointerEvents = "none";
    ghost.style.boxShadow = "0 8px 32px rgba(0,0,0,0.18)";
    ghost.style.borderRadius = "8px";
    ghost.style.transition = "transform 0.1s ease-out";
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
    return ghost;
  }, []);

  const moveGhost = useCallback((deltaX: number, deltaY: number) => {
    if (!ghostRef.current) return;
    const currentTop = parseFloat(ghostRef.current.style.top);
    const currentLeft = parseFloat(ghostRef.current.style.left);
    ghostRef.current.style.top = `${currentTop + deltaY}px`;
    ghostRef.current.style.left = `${currentLeft + deltaX}px`;
  }, []);

  const removeGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
  }, []);

  const findItemAtPoint = useCallback((x: number, y: number): number | null => {
    let found: number | null = null;
    itemRefs.current.forEach((el, index) => {
      if (found !== null) return;
      const rect = el.getBoundingClientRect();
      if (y >= rect.top && y <= rect.bottom && x >= rect.left && x <= rect.right) {
        found = index;
      }
    });
    return found;
  }, []);

  const autoScroll = useCallback((y: number) => {
    clearAutoScroll();
    const threshold = 60;
    const speed = 8;
    const viewportHeight = window.innerHeight;

    if (y < threshold) {
      scrollInterval.current = setInterval(() => {
        window.scrollBy(0, -speed);
      }, 16);
    } else if (y > viewportHeight - threshold) {
      scrollInterval.current = setInterval(() => {
        window.scrollBy(0, speed);
      }, 16);
    }
  }, [clearAutoScroll]);

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      itemRefs.current.set(index, element);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    const touch = e.touches[0];
    startX.current = touch.clientX;
    startY.current = touch.clientY;

    longPressTimer.current = setTimeout(() => {
      // ロングプレス成功 → ドラッグ開始
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
      const el = itemRefs.current.get(index);
      if (el) {
        createGhost(el, touch.clientX, touch.clientY);
      }
      setState({ isDragging: true, dragIndex: index, overIndex: index });
    }, longPressDelay);
  }, [longPressDelay, createGhost]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startX.current;
    const dy = touch.clientY - startY.current;

    // ロングプレス判定中に指が動いたらキャンセル
    if (!state.isDragging) {
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        clearLongPress();
      }
      return;
    }

    // ドラッグ中
    e.preventDefault();
    moveGhost(touch.clientX - startX.current, touch.clientY - startY.current);
    startX.current = touch.clientX;
    startY.current = touch.clientY;

    // 自動スクロール
    autoScroll(touch.clientY);

    // ドロップ先を検出
    const overIdx = findItemAtPoint(touch.clientX, touch.clientY);
    if (overIdx !== null && overIdx !== state.overIndex) {
      setState((prev) => ({ ...prev, overIndex: overIdx }));
    }
  }, [state.isDragging, state.overIndex, clearLongPress, moveGhost, autoScroll, findItemAtPoint]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    clearAutoScroll();
    removeGhost();

    if (state.isDragging && state.dragIndex !== null && state.overIndex !== null && state.dragIndex !== state.overIndex) {
      onReorder(state.dragIndex, state.overIndex);
    }

    setState({ isDragging: false, dragIndex: null, overIndex: null });
  }, [state, clearLongPress, clearAutoScroll, removeGhost, onReorder]);

  return {
    ...state,
    registerItem,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
