import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Typography,
  Divider,
  Avatar,
  TextField,
  IconButton,
  Tabs,
  Tab,
  InputAdornment,
  Pagination,
  CircularProgress,
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { Channel } from '../models/Channel';
import { channelService } from '../services/channelService';

interface ChannelListProps {
  selectedChannel?: Channel;
  onChannelSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onRefresh?: () => void;
}

type TabValue = 'all' | 'favorites' | 'recent';

export const ChannelList: React.FC<ChannelListProps> = ({
  selectedChannel,
  onChannelSelect,
  onToggleFavorite,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [channelInput, setChannelInput] = useState('');
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const pageSize = 100;

  const loadChannels = useCallback(async () => {
    try {
      setLoading(true);
      const response = await channelService.getChannels(page, pageSize, {
        search: searchTerm,
        group: activeTab === 'all' ? undefined : activeTab,
        favoritesOnly: activeTab === 'favorites'
      });
      setChannels(response.items);
      setTotalPages(Math.ceil(response.total / pageSize));
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, activeTab]);

  useEffect(() => {
    loadChannels();
  }, [loadChannels]);

  // Move useMemo hooks before any conditional rendering
  const filteredChannels = React.useMemo(() => {
    let filtered = channels;

    if (activeTab === 'favorites') {
      filtered = filtered.filter(c => c.isFavorite);
    } else if (activeTab === 'recent') {
      filtered = filtered.filter(c => c.lastWatched)
        .sort((a, b) => (b.lastWatched?.getTime() || 0) - (a.lastWatched?.getTime() || 0));
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(search) ||
        c.number?.includes(search) ||
        c.group.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [channels, searchTerm, activeTab]);

  const groupedChannels = React.useMemo(() => {
    return filteredChannels.reduce((acc, channel) => {
      const group = channel.group || 'Uncategorized';
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(channel);
      return acc;
    }, {} as Record<string, Channel[]>);
  }, [filteredChannels]);

  const handleChannelInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const channel = channels.find(c => c.number === channelInput);
      if (channel) {
        onChannelSelect(channel);
        setChannelInput('');
      }
    }
  };

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small"
          placeholder="Channel #"
          value={channelInput}
          onChange={(e) => setChannelInput(e.target.value)}
          onKeyPress={handleChannelInput}
          sx={{ mt: 1, width: '100px' }}
        />
      </Box>

      <Tabs
        value={activeTab}
        onChange={(_, newValue) => setActiveTab(newValue)}
        variant="fullWidth"
      >
        <Tab label="All" value="all" />
        <Tab label="Favorites" value="favorites" />
        <Tab label="Recent" value="recent" />
      </Tabs>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <List sx={{ flexGrow: 1, overflow: 'auto' }}>
            {Object.entries(groupedChannels).map(([group, groupChannels]) => (
              <Box key={group}>
                <ListItem>
                  <Typography variant="subtitle1" color="primary" fontWeight="bold">
                    {group}
                  </Typography>
                </ListItem>
                {groupChannels.map((channel) => (
                  <ListItemButton
                    key={channel.id}
                    selected={channel.id === selectedChannel?.id}
                    onClick={() => onChannelSelect(channel)}
                  >
                    <ListItemIcon>
                      <Avatar
                        src={channel.logo}
                        alt={channel.name}
                        variant="square"
                        sx={{ width: 32, height: 32 }}
                      >
                        {channel.name[0]}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={channel.name}
                      secondary={channel.number}
                    />
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleFavorite(channel);
                        }}
                      >
                        {channel.isFavorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItemButton>
                ))}
                <Divider />
              </Box>
            ))}
          </List>
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
            <Pagination 
              count={totalPages}
              page={page + 1}
              onChange={(_, value) => setPage(value - 1)}
              color="primary"
              size="small"
            />
          </Box>
        </>
      )}
    </Paper>
  );
}; 