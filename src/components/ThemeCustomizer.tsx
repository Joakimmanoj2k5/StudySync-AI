import { useMemo, useState } from 'react';
import { Check, Palette } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui';
import { applyThemePreset, getStoredThemePreset, themePresets, type ThemePresetId } from '@/utils/theme';

export function ThemeCustomizer() {
  const initialTheme = useMemo(() => getStoredThemePreset(), []);
  const [activeTheme, setActiveTheme] = useState<ThemePresetId>(initialTheme);

  const handleThemeChange = (themeId: ThemePresetId) => {
    setActiveTheme(themeId);
    applyThemePreset(themeId);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="btn-shine w-full sm:w-auto">
          <Palette className="mr-2 h-4 w-4" />
          Theme
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Theme Studio</DialogTitle>
          <DialogDescription>
            Pick the workspace look you want. Your theme is saved automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {themePresets.map((theme) => {
            const isActive = theme.id === activeTheme;

            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                className={`w-full rounded-xl border p-3 text-left transition-all ${
                  isActive
                    ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                    : 'border-border/70 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex items-center gap-1">
                    {theme.preview.map((color) => (
                      <span
                        key={color}
                        className="h-4 w-4 rounded-full border border-white/20"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{theme.name}</p>
                      {isActive && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{theme.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <Button variant="outline" size="sm" onClick={() => handleThemeChange('forest')} className="w-full">
          Reset To Default Theme
        </Button>
      </DialogContent>
    </Dialog>
  );
}
