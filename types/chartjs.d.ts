import { ChartConfiguration } from 'chart.js';

declare module 'chartjs-adapter-date-fns';

interface TimeScale {
    type: 'time';
    time: {
        unit: string;
        displayFormats: {
            [key: string]: string;
        };
    };
    adapters?: {
        date: {
            locale: any;
        };
    };
}

interface ExtendedChartConfiguration extends ChartConfiguration {
    options?: {
        scales?: {
            x?: TimeScale;
            y?: any;
            volume?: any;
        };
    };
}
