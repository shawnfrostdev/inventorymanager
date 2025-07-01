import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeGeneratorProps {
  value: string;
  format?: 'CODE128' | 'EAN13' | 'EAN8' | 'UPC';
  width?: number;
  height?: number;
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
}

export default function BarcodeGenerator({
  value,
  format = 'CODE128',
  width = 2,
  height = 100,
  displayValue = true,
  fontSize = 20,
  className = ''
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current && value) {
      try {
        JsBarcode(canvasRef.current, value, {
          format,
          width,
          height,
          displayValue,
          fontSize,
          background: '#ffffff',
          lineColor: '#000000',
        });
      } catch (error) {
        console.error('Barcode generation failed:', error);
      }
    }
  }, [value, format, width, height, displayValue, fontSize]);

  if (!value) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 border rounded p-4 ${className}`}>
        <span className="text-gray-500">No barcode value</span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <canvas ref={canvasRef} className="border rounded" />
      {!displayValue && (
        <span className="text-xs text-gray-600 mt-1">{value}</span>
      )}
    </div>
  );
}

// Utility function to generate barcode value
export const generateBarcode = (prefix: string = 'INV'): string => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp.slice(-8)}${random}`;
};

// Utility function to validate barcode
export const validateBarcode = (barcode: string): boolean => {
  if (!barcode) return false;
  
  // Basic validation - can be enhanced based on barcode format
  const minLength = 8;
  const maxLength = 18;
  const isValidLength = barcode.length >= minLength && barcode.length <= maxLength;
  const isAlphanumeric = /^[A-Za-z0-9]+$/.test(barcode);
  
  return isValidLength && isAlphanumeric;
}; 