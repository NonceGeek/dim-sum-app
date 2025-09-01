export interface DictionaryNote {
  context: {
    page?: number;
    number?: string;
    others?: {
      異體?: any[];
      校訂註?: string | null;
    };
    pinyin?: string[];
    meaning?: string[];
  };
  contributor?: string;
}
