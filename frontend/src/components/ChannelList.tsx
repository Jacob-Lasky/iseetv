import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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

export {};

interface ChannelListProps {
  selectedChannel?: Channel;
  onChannelSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  onRefresh?: (refreshFn: (() => Promise<void>) | undefined) => void;
  showChannelNumbers?: boolean;
  onToggleChannelNumbers?: () => void;
}

type TabValue = 'all' | 'favorites' | 'recent';

interface ChannelListItemProps {
  channel: Channel;
  selected: boolean;
  onSelect: (channel: Channel) => void;
  onToggleFavorite: (channel: Channel) => void;
  indented?: boolean;
  showChannelNumbers?: boolean;
}

const ChannelListItem: React.FC<ChannelListItemProps> = ({
  channel,
  selected,
  onSelect,
  onToggleFavorite,
  indented = false,
  showChannelNumbers = false,
}) => (
  <ListItemButton
    selected={selected}
    onClick={() => onSelect(channel)}
    sx={{ pl: indented ? 4 : 2 }}
  >
    <IconButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite(channel);
      }}
      sx={{ mr: 1 }}
    >
      {channel.isFavorite ? <StarIcon color="primary" /> : <StarBorderIcon />}
    </IconButton>
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
      secondary={showChannelNumbers ? channel.channel_number : undefined}
    />
  </ListItemButton>
);

interface TabState {
  scrollPosition: number;
  expandedGroups: Record<string, boolean>;
}

export const ChannelList: React.FC<ChannelListProps> = ({
  selectedChannel,
  onChannelSelect,
  onToggleFavorite,
  onRefresh,
  showChannelNumbers = false,
  onToggleChannelNumbers,
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
  const [groupChannels, setGroupChannels] = useState<Record<string, Channel[]>>({});

  // Replace separate scroll positions and expandedGroups with combined tab state
  const [tabStates, setTabStates] = useState<Record<TabValue, TabState>>({
    all: {
      scrollPosition: parseInt(localStorage.getItem('channelListScroll_all') || '0'),
      expandedGroups: JSON.parse(localStorage.getItem('channelListGroups_all') || '{}'),
    },
    favorites: {
      scrollPosition: parseInt(localStorage.getItem('channelListScroll_favorites') || '0'),
      expandedGroups: JSON.parse(localStorage.getItem('channelListGroups_favorites') || '{}'),
    },
    recent: {
      scrollPosition: parseInt(localStorage.getItem('channelListScroll_recent') || '0'),
      expandedGroups: JSON.parse(localStorage.getItem('channelListGroups_recent') || '{}'),
    },
  });

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

      // Only replace channels if we're not in the 'all' tab or it's the first load
      if (activeTab !== 'all' || !loadMore) {
        setChannels(prev => 
          loadMore ? [...prev, ...response.items] : response.items
        );
      }
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

  // Combine the initialization effects into one and load channels for expanded groups
  useEffect(() => {
    // Initialize expanded groups from the current tab's state
    const savedExpandedGroups = tabStates[activeTab].expandedGroups;
    
    // Only set groups as expanded if we actually have their channels loaded
    // OR if we're currently loading them (group is marked as expanded)
    const validExpandedGroups = { ...savedExpandedGroups };
    Object.keys(savedExpandedGroups).forEach(group => {
      // Keep the group expanded if it's already expanded, even if channels aren't loaded yet
      if (savedExpandedGroups[group] === true) {
        validExpandedGroups[group] = true;
      }
    });
    
    setExpandedGroups(validExpandedGroups);

    // Save the corrected state back to localStorage
    localStorage.setItem(`channelListGroups_${activeTab}`, JSON.stringify(validExpandedGroups));

    // Load channels for any expanded groups
    const loadExpandedGroups = async () => {
      const expandedGroupNames = Object.entries(validExpandedGroups)
        .filter(([_, isExpanded]) => isExpanded)
        .map(([groupName]) => groupName);

      if (expandedGroupNames.length > 0) {
        setLoading(true);
        try {
          const promises = expandedGroupNames.map(group =>
            channelService.getChannels(0, 1000, {
              group,
              search: searchTerm,
              favoritesOnly: activeTab === 'favorites'
            })
          );

          const responses = await Promise.all(promises);
          const allChannels = responses.flatMap(response => response.items);
          
          // Update channels without clearing existing ones
          setChannels(prev => {
            const uniqueChannels = [...prev];
            allChannels.forEach(channel => {
              const exists = uniqueChannels.some(c => c.channel_number === channel.channel_number);
              if (!exists) {
                uniqueChannels.push(channel);
              }
            });
            return uniqueChannels;
          });
        } catch (error) {
          console.error('Failed to load channels for expanded groups:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    // Restore scroll position
    const listElement = listRef.current;
    if (listElement) {
      requestAnimationFrame(() => {
        listElement.scrollTop = tabStates[activeTab].scrollPosition;
      });
    }

    loadExpandedGroups();
  }, [activeTab, tabStates, searchTerm, groupChannels]);

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
        // Only load initial channels if we're not in the 'all' tab
        if (activeTab !== 'all') {
          await loadChannels(false);
        }
      } catch (error) {
        console.error('Failed to initialize channel list:', error);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [loadGroups, loadChannels, activeTab]);

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

  // Update handleToggleGroup to store channels by group
  const handleToggleGroup = async (group: string) => {
    // Store current scroll position
    const currentScrollPosition = listRef.current?.scrollTop || 0;
    
    const isExpanding = !expandedGroups[group];
    const newExpandedGroups = {
      ...expandedGroups,
      [group]: !expandedGroups[group]
    };
    setExpandedGroups(newExpandedGroups);

    // Save expanded groups state for current tab
    const newTabStates = {
      ...tabStates,
      [activeTab]: {
        ...tabStates[activeTab],
        expandedGroups: newExpandedGroups,
        scrollPosition: currentScrollPosition  // Save current scroll position
      }
    };
    setTabStates(newTabStates);
    localStorage.setItem(`channelListGroups_${activeTab}`, JSON.stringify(newExpandedGroups));

    // Load channels if needed
    if (isExpanding && (!groupChannels[group] || groupChannels[group].length === 0)) {
      setLoading(true);
      try {
        const response = await channelService.getChannels(0, 1000, {
          group: group,
          search: searchTerm,
          favoritesOnly: activeTab === 'favorites'
        });

        setGroupChannels(prev => ({
          ...prev,
          [group]: response.items
        }));

        // Restore scroll position after content loads
        requestAnimationFrame(() => {
          if (listRef.current) {
            listRef.current.scrollTop = currentScrollPosition;
          }
        });

      } catch (error) {
        console.error('Failed to load channels for group:', error);
        // If loading fails, revert the expanded state
        setExpandedGroups(prev => ({
          ...prev,
          [group]: false
        }));
        setTabStates(prev => ({
          ...prev,
          [activeTab]: {
            ...prev[activeTab],
            expandedGroups: {
              ...prev[activeTab].expandedGroups,
              [group]: false
            }
          }
        }));
        localStorage.setItem(`channelListGroups_${activeTab}`, JSON.stringify({
          ...newExpandedGroups,
          [group]: false
        }));
      } finally {
        setLoading(false);
      }
    }
  };

  // Update the groupedChannels memo to use groupChannels
  const groupedChannels = React.useMemo(() => {
    const result: Record<string, Channel[]> = {};
    Object.entries(groupChannels).forEach(([group, channels]) => {
      result[group] = channels.filter(channel => {
        if (searchTerm) {
          const search = searchTerm.toLowerCase();
          return (
            channel.name.toLowerCase().includes(search) ||
            channel.channel_number.toString().includes(search) ||
            channel.group.toLowerCase().includes(search)
          );
        }
        return true;
      });
    });
    return result;
  }, [groupChannels, searchTerm]);

  const handleChannelInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const channel = channels.find(c => c.channel_number === parseInt(channelInput));
      if (channel) {
        onChannelSelect(channel);
        setChannelInput('');
      }
    }
  };

  const handleToggleFavorite = async (channel: Channel) => {
    try {
      const updatedChannel = await channelService.toggleFavorite(channel.channel_number);
      
      // Update channel in main channels list
      setChannels(prev => prev.map(ch => 
        ch.channel_number === updatedChannel.channel_number 
          ? { ...ch, isFavorite: updatedChannel.isFavorite }
          : ch
      ));

      // Update channel in group channels
      setGroupChannels(prev => {
        const newGroupChannels = { ...prev };
        Object.keys(newGroupChannels).forEach(group => {
          newGroupChannels[group] = newGroupChannels[group].map(ch =>
            ch.channel_number === updatedChannel.channel_number
              ? { ...ch, isFavorite: updatedChannel.isFavorite }
              : ch
          );
        });
        return newGroupChannels;
      });

      // If we're in favorites tab and unfavoriting, remove the channel
      if (activeTab === 'favorites' && !updatedChannel.isFavorite) {
        setChannels(prev => prev.filter(ch => ch.channel_number !== updatedChannel.channel_number));
      }

      // If we're in favorites tab and favoriting, we might need to reload the list
      if (activeTab === 'favorites' && updatedChannel.isFavorite) {
        loadChannels(false);
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
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

  // Update tab change handler to preserve channels
  const handleTabChange = (_: any, newValue: TabValue) => {
    if (listRef.current) {
      // Save current scroll position
      const currentScrollPosition = listRef.current.scrollTop;
      
      // Save to localStorage and state
      localStorage.setItem(`channelListScroll_${activeTab}`, currentScrollPosition.toString());
      setTabStates(prev => ({
        ...prev,
        [activeTab]: {
          ...prev[activeTab],
          scrollPosition: currentScrollPosition
        }
      }));

      // Change tab
      setActiveTab(newValue);

      // Reset scroll position immediately to prevent jumps
      listRef.current.scrollTop = 0;
    }
  };

  // Separate effect for scroll position restoration
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    // Use a small timeout to ensure the content is rendered
    const timer = setTimeout(() => {
      const savedPosition = tabStates[activeTab].scrollPosition;
      listElement.scrollTop = savedPosition;
    }, 50);

    return () => clearTimeout(timer);
  }, [activeTab, tabStates]);

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
        {showChannelNumbers && (
          <TextField
            size="small"
            placeholder="Channel #"
            value={channelInput}
            onChange={(e) => setChannelInput(e.target.value)}
            onKeyPress={handleChannelInput}
            sx={{ mt: 1, width: '100px' }}
          />
        )}
      </Box>

      <Tabs
        value={activeTab}
        onChange={handleTabChange}  // Use the new handler
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
        {activeTab === 'all' ? (
          // Show grouped channels for 'all' tab
          groups.map(({ name: group, count }) => (
            <Box key={group}>
              <ListItemButton onClick={() => handleToggleGroup(group)} sx={{ pl: 2 }}>
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
                  <ChannelListItem 
                    key={channel.channel_number}
                    channel={channel}
                    selected={channel.channel_number === selectedChannel?.channel_number}
                    onSelect={onChannelSelect}
                    onToggleFavorite={handleToggleFavorite}
                    showChannelNumbers={showChannelNumbers}
                  />
                ))}
              </Collapse>
              <Divider />
            </Box>
          ))
        ) : (
          // Show flat list for favorites and recent tabs
          filteredChannels.map((channel) => (
            <React.Fragment key={channel.channel_number}>
              <ChannelListItem 
                channel={channel}
                selected={channel.channel_number === selectedChannel?.channel_number}
                onSelect={onChannelSelect}
                onToggleFavorite={handleToggleFavorite}
                showChannelNumbers={showChannelNumbers}
              />
              <Divider />
            </React.Fragment>
          ))
        )}
        
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </List>
    </Paper>
  );
}; 