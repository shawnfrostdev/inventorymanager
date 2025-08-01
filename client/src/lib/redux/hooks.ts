import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import type { RootState } from './types';
import { store } from './store';

export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector; 