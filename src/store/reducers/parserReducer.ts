import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ParserState {
  status: 'ACTIVE' | 'INACTIVE' | 'ERROR';
  lastRun: string | null;
  processedItems: number;
  errors: string[];
}

const initialState: ParserState = {
  status: 'INACTIVE',
  lastRun: null,
  processedItems: 0,
  errors: []
};

const parserSlice = createSlice({
  name: 'parser',
  initialState,
  reducers: {
    updateStatus: (state, action: PayloadAction<ParserState>) => {
      return {
        ...state,
        ...action.payload
      };
    },
    resetStatus: (state) => {
      return initialState;
    }
  }
});

export const { updateStatus, resetStatus } = parserSlice.actions;
export default parserSlice.reducer;