import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  List,
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
  CircularProgress,
  Collapse,
} from '@mui/material';
import {
  Search as SearchIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
  ExpandLess,
  ExpandMore,
} from '@mui/icons-material';
import { Channel } from '../models/Channel';
import { channelService } from '../services/channelService';
import { ChannelGroup } from '../types/api';

interface ChannelListProps {
  selectedChannel?: Channel;
  onChannelSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onRefresh?: (refreshFn: (() => Promise<void>) | undefined) => void;
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
  const [loading, setLoading] = useState(false);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(() => {
    // Load saved page from localStorage
    const saved = localStorage.getItem('channelListPage');
    return saved ? parseInt(saved) : 0;
  });
  const pageSize = 50;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const [groups, setGroups] = useState<ChannelGroup[]>([]);

  const loadChannels = useCallback(async (loadMore = false) => {
    try {
      setLoading(true);
      const response = await channelService.getChannels(
        loadMore ? page * pageSize : 0,  // Calculate correct offset
        pageSize,
        {
          search: searchTerm,
          group: activeTab === 'all' ? undefined : activeTab,
          favoritesOnly: activeTab === 'favorites'
        }
      );

      setChannels(prev => 
        loadMore ? [...prev, ...response.items] : response.items
      );
      setHasMore(response.items.length === pageSize);
    } catch (error) {
      console.error('Failed to load channels:', error);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, activeTab, pageSize]);

  const loadGroups = useCallback(async () => {
    try {
      const groups = await channelService.getGroups();
      setGroups(groups);
      
      // Initialize expanded state for all groups
      setExpandedGroups(prev => {
        const newState = { ...prev };
        groups.forEach((group: ChannelGroup) => {
          if (!(group.name in newState)) {
            newState[group.name] = false;  // All collapsed by default
          }
        });
        return newState;
      });
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }, []);

  // Save scroll position when unmounting
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    const savedScrollTop = localStorage.getItem('channelListScroll');
    if (savedScrollTop) {
      listElement.scrollTop = parseInt(savedScrollTop);
    }

    return () => {
      localStorage.setItem('channelListScroll', listElement.scrollTop.toString());
    };
  }, []);

  // Save page number when it changes
  useEffect(() => {
    localStorage.setItem('channelListPage', page.toString());
  }, [page]);

  // Initial load of both groups and channels
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        // Load groups first
        await loadGroups();
        // Then load initial channels
        await loadChannels(false);  // explicitly pass false for initial load
      } catch (error) {
        console.error('Failed to initialize channel list:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadGroups, loadChannels]); // Add the dependencies

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;

    // Load more when near bottom
    if (scrollHeight - scrollTop - clientHeight < 100 && !loading && hasMore) {
      setPage(prev => prev + 1);
      loadChannels(true);
    }
  }, [loading, hasMore, loadChannels]);

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
        c.channel_number.toString().includes(search) ||
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
      const channel = channels.find(c => c.channel_number === parseInt(channelInput));
      if (channel) {
        onChannelSelect(channel);
        setChannelInput('');
      }
    }
  };

  const handleToggleGroup = (group: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [group]: !prev[group]
    }));
  };

  // Move refresh function definition before the useEffect
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadGroups();
      await loadChannels(false);
    } catch (error) {
      console.error('Failed to refresh channel list:', error);
    } finally {
      setLoading(false);
    }
  }, [loadGroups, loadChannels]);

  // Set the refresh function immediately when component mounts
  useEffect(() => {
    if (onRefresh) {
      onRefresh(refresh);
    }
    return () => {
      if (onRefresh) {
        onRefresh(undefined);
      }
    };
  }, [onRefresh, refresh]);

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

      <List 
        component="div"
        ref={listRef}
        onScroll={handleScroll}
        sx={{ 
          flexGrow: 1, 
          overflow: 'auto',
          position: 'relative' 
        }}
      >
        {groups.map(({ name: group, count }) => (
          <Box key={group}>
            <ListItemButton onClick={() => handleToggleGroup(group)}>
              <ListItemText
                primary={
                  <Typography variant="subtitle1" color="primary" fontWeight="bold">
                    {group} ({count})
                  </Typography>
                }
              />
              {expandedGroups[group] ? <ExpandLess /> : <ExpandMore />}
            </ListItemButton>
            <Collapse in={expandedGroups[group]} timeout="auto">
              {expandedGroups[group] && groupedChannels[group]?.map((channel) => (
                <ListItemButton
                  key={channel.channel_number}
                  selected={channel.channel_number === selectedChannel?.channel_number}
                  onClick={() => onChannelSelect(channel)}
                  sx={{ pl: 4 }}
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
                    secondary={channel.channel_number}
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
            </Collapse>
            <Divider />
          </Box>
        ))}
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </List>
    </Paper>
  );
}; 