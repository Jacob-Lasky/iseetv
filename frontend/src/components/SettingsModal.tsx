import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { Settings } from '../models/Settings';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  settings: Settings;
  onSave: (settings: Settings) => void;
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  settings,
  onSave,
  onThemeChange,
}) => {
  const [formData, setFormData] = useState<Settings>(settings);

  return (
    <Dialog 
      open={open} 
      onClose={settings.m3uUrl ? onClose : undefined}
      maxWidth="sm" 
      fullWidth
    >
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={{ mt: 2 }}>
          <TextField
            label="M3U URL"
            required
            fullWidth
            value={formData.m3uUrl}
            onChange={(e) => setFormData({ ...formData, m3uUrl: e.target.value })}
            error={!formData.m3uUrl}
            helperText={!formData.m3uUrl ? "M3U URL is required" : ""}
          />
          
          <TextField
            label="EPG URL (Optional)"
            fullWidth
            value={formData.epgUrl}
            onChange={(e) => setFormData({ ...formData, epgUrl: e.target.value })}
          />
          
          <TextField
            label="Update Interval (hours)"
            type="number"
            fullWidth
            value={formData.updateInterval}
            onChange={(e) => setFormData({ ...formData, updateInterval: Number(e.target.value) })}
          />
          
          <FormControlLabel
            control={
              <Switch
                checked={formData.updateOnStart}
                onChange={(e) => setFormData({ ...formData, updateOnStart: e.target.checked })}
              />
            }
            label="Update on App Start"
          />
          
          <FormControl fullWidth>
            <InputLabel>Theme</InputLabel>
            <Select
              value={formData.theme}
              onChange={(e) => {
                const newTheme = e.target.value as 'light' | 'dark' | 'system';
                setFormData({ ...formData, theme: newTheme });
                onThemeChange?.(newTheme);
              }}
            >
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            onClick={() => onSave(formData)} 
            fullWidth
            disabled={!formData.m3uUrl}
          >
            Save Settings
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}; 