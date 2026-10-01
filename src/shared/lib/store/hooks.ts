import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

/**
 * Типизированные хуки Redux. `RootState` и `AppDispatch` объявлены глобально
 * в app/providers/store: так features и widgets не импортируют ничего из слоя app.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();

/** Thunk приложения: `dispatch(thunk())` возвращает `Result`. */
export type AppThunk<Result = void> = ThunkAction<Result, RootState, unknown, UnknownAction>;
