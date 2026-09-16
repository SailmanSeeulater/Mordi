import { useContext } from 'react';
import { ThemeContext } from './theme-context-value';

export const useTheme = () => useContext(ThemeContext);
