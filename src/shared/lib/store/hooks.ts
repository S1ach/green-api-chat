import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

export type AppThunk<Result = void> = ThunkAction<Result, RootState, unknown, UnknownAction>;
