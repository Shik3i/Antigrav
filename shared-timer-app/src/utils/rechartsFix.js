let applied = false;

export function applyRechartsStyleSheetFix() {
  if (applied || typeof document === 'undefined' || typeof Document === 'undefined') {
    return;
  }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'styleSheets');
    if (descriptor && descriptor.configurable) {
      Object.defineProperty(document, 'styleSheets', {
        get() {
          const sheets = descriptor.get.call(this);
          if (!sheets) return [];
          return Array.from(sheets).filter((sheet) => {
            try {
              return !!sheet && !!sheet.cssRules;
            } catch (error) {
              return false;
            }
          });
        },
        configurable: true
      });
      applied = true;
    }
  } catch (error) {
    console.warn('Recharts CSS fix could not be applied:', error);
  }
}
