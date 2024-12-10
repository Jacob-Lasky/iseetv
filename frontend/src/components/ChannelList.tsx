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
import { recentChannelsService } from '../services/recentChannelsService';

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

interface ChannelIndex {
  nameIndex: Map<string, Channel[]>;
  numberIndex: Map<number, Channel>;
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
  const [channelIndex, setChannelIndex] = useState<ChannelIndex>({
    nameIndex: new Map(),
    numberIndex: new Map()
  });

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

  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const initiateSearch = useCallback((term: string) => {
    setDebouncedSearchTerm(term);
  }, []);

  const loadChannels = useCallback(async (loadMore = false) => {
    try {
      setLoading(true);
      const response = await channelService.getChannels(
        loadMore ? page * pageSize : 0,
        pageSize,
        {
          search: debouncedSearchTerm,
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
  }, [page, debouncedSearchTerm, activeTab, pageSize]);

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
              search: debouncedSearchTerm,
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
  }, [activeTab, tabStates, debouncedSearchTerm, groupChannels]);

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

  const updateChannelIndex = useCallback((channels: Channel[]) => {
    const nameIndex = new Map<string, Channel[]>();
    const numberIndex = new Map<number, Channel>();

    channels.forEach(channel => {
      // Index by channel number
      numberIndex.set(channel.channel_number, channel);

      // Index by name - split into words for partial matching
      const words = channel.name.toLowerCase().split(/\s+/);
      words.forEach(word => {
        const existing = nameIndex.get(word) || [];
        nameIndex.set(word, [...existing, channel]);
      });
    });

    setChannelIndex({ nameIndex, numberIndex });
  }, []);

  // Update the filteredChannels memo to use the index for searching
  const filteredChannels = React.useMemo(() => {
    let filtered = channels;

    if (activeTab === 'favorites') {
      filtered = filtered.filter(c => c.isFavorite);
    } else if (activeTab === 'recent') {
      filtered = recentChannelsService.getRecentChannels();
    }

    if (debouncedSearchTerm) {
      const search = debouncedSearchTerm.toLowerCase();
      const searchWords = search.split(/\s+/);
      
      if (channelIndex.nameIndex.size > 0) {
        const matchingSets = searchWords.map(word => {
          const matches: Channel[] = [];
          channelIndex.nameIndex.forEach((channels, indexWord) => {
            if (indexWord.includes(word)) {
              matches.push(...channels);
            }
          });
          return matches;
        });

        // Find channels that match all search words
        filtered = matchingSets.reduce((acc, matches) => {
          if (acc.length === 0) return matches;
          return acc.filter(channel => 
            matches.some(match => match.channel_number === channel.channel_number)
          );
        }, [] as Channel[]);
      } else {
        filtered = filtered.filter(c => 
          c.name.toLowerCase().includes(search) ||
          c.channel_number.toString().includes(search)
        );
      }
    }

    return filtered;
  }, [channels, debouncedSearchTerm, activeTab, channelIndex]);

  // Update the index when channels change
  useEffect(() => {
    updateChannelIndex(channels);
  }, [channels, updateChannelIndex]);

  // Update the groupedChannels memo to also use the index
  const groupedChannels = React.useMemo(() => {
    const result: Record<string, Channel[]> = {};
    Object.entries(groupChannels).forEach(([group, channels]) => {
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
        const searchWords = search.split(/\s+/);
        
        // Use index for searching
        if (channelIndex.nameIndex.size > 0) {
          const matchingSets = searchWords.map(word => {
            const matches: Channel[] = [];
            channelIndex.nameIndex.forEach((indexedChannels, indexWord) => {
              if (indexWord.includes(word)) {
                indexedChannels.forEach(channel => {
                  if (channel.group === group) {
                    matches.push(channel);
                  }
                });
              }
            });
            return matches;
          });

          // Find channels that match all search words
          result[group] = matchingSets.reduce((acc, matches) => {
            if (acc.length === 0) return matches;
            return acc.filter(channel => 
              matches.some(match => match.channel_number === channel.channel_number)
            );
          }, [] as Channel[]);
        } else {
          // Fallback
          result[group] = channels.filter(channel =>
            channel.name.toLowerCase().includes(search)
          );
        }
      } else {
        result[group] = channels;
      }
    });
    return result;
  }, [groupChannels, debouncedSearchTerm, channelIndex]);

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
      // Optimistically update the UI
      const newFavoriteStatus = !channel.isFavorite;
      
      // Update all channel states at once
      const updateChannelInState = (ch: Channel) => 
        ch.channel_number === channel.channel_number 
          ? { ...ch, isFavorite: newFavoriteStatus }
          : ch;

      setChannels(prev => prev.map(updateChannelInState));
      setGroupChannels(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(group => {
          if (newState[group]) {
            newState[group] = newState[group].map(updateChannelInState);
          }
        });
        return newState;
      });

      // Call the backend to toggle the favorite status
      const updatedChannel = await channelService.toggleFavorite(channel.channel_number);

      // Ensure the UI reflects the backend's response
      setChannels(prev => prev.map(ch => 
        ch.channel_number === updatedChannel.channel_number 
          ? { ...ch, isFavorite: updatedChannel.isFavorite }
          : ch
      ));

      // Update channel index
      setChannelIndex(prev => {
        const newNameIndex = new Map(prev.nameIndex);
        newNameIndex.forEach((channels, word) => {
          newNameIndex.set(word, channels.map(updateChannelInState));
        });
        
        const newNumberIndex = new Map(prev.numberIndex);
        if (newNumberIndex.has(updatedChannel.channel_number)) {
          newNumberIndex.set(updatedChannel.channel_number, {
            ...newNumberIndex.get(updatedChannel.channel_number)!,
            isFavorite: updatedChannel.isFavorite
          });
        }
        
        return {
          nameIndex: newNameIndex,
          numberIndex: newNumberIndex
        };
      });

      // If we're in favorites tab and unfavoriting, remove the channel
      if (activeTab === 'favorites' && !updatedChannel.isFavorite) {
        setChannels(prev => prev.filter(ch => ch.channel_number !== updatedChannel.channel_number));
      }
      // If we're in favorites tab and favoriting, add the channel
      else if (activeTab === 'favorites' && updatedChannel.isFavorite) {
        setChannels(prev => {
          if (!prev.some(ch => ch.channel_number === updatedChannel.channel_number)) {
            return [...prev, updatedChannel];
          }
          return prev;
        });
      }

    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // Revert all states if the backend call fails
      const revertChannelInState = (ch: Channel) => 
        ch.channel_number === channel.channel_number 
          ? { ...ch, isFavorite: channel.isFavorite }
          : ch;

      setChannels(prev => prev.map(revertChannelInState));
      setGroupChannels(prev => {
        const newState = { ...prev };
        Object.keys(newState).forEach(group => {
          if (newState[group]) {
            newState[group] = newState[group].map(revertChannelInState);
          }
        });
        return newState;
      });
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

  // Update tab change handler to handle scroll position better
  const handleTabChange = (_: any, newValue: TabValue) => {
    if (listRef.current) {
      const listElement = listRef.current;
      // Save current scroll position
      const currentScrollPosition = listElement.scrollTop;
      
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
      listElement.scrollTop = 0;
    }
  };

  // Update scroll position restoration effect
  useEffect(() => {
    const listElement = listRef.current;
    if (!listElement) return;

    // Use a small timeout to ensure the content is rendered
    const timer = setTimeout(() => {
      const savedPosition = tabStates[activeTab].scrollPosition;
      // Calculate maximum scroll position
      const maxScroll = listElement.scrollHeight - listElement.clientHeight;
      // Use the smaller of saved position or maximum scroll
      const safeScrollPosition = Math.min(savedPosition, maxScroll);
      listElement.scrollTop = safeScrollPosition;
    }, 100); // Increased timeout to ensure content is fully rendered

    return () => clearTimeout(timer);
  }, [activeTab, tabStates, channels, groupChannels]); // Added dependencies to re-run when content changes

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
          search: debouncedSearchTerm,
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

  // Clean up the timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Reload the favorites list when switching to the favorites tab
  useEffect(() => {
    if (activeTab === 'favorites') {
      loadChannels(false);
    }
  }, [activeTab, loadChannels]);

  const handleChannelSelect = (channel: Channel) => {
    // Add to recent channels
    recentChannelsService.addRecentChannel(channel);
    // Call the original onChannelSelect
    onChannelSelect(channel);
  };

  return (
    <Paper elevation={3} sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 1 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search channels..."
          value={searchTerm}
          onChange={(e) => {
            const newTerm = e.target.value;
            setSearchTerm(newTerm);
            
            // Clear any existing timeout
            if (searchTimeoutRef.current) {
              clearTimeout(searchTimeoutRef.current);
            }

            // Set new timeout for debounced search
            searchTimeoutRef.current = setTimeout(() => {
              initiateSearch(newTerm);
            }, 1000);
          }}
          onBlur={() => initiateSearch(searchTerm)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
              }
              initiateSearch(searchTerm);
            }
          }}
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
        {activeTab === 'all' && !debouncedSearchTerm ? (
          // Show grouped channels only when not searching
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
                    onSelect={handleChannelSelect}
                    onToggleFavorite={handleToggleFavorite}
                    showChannelNumbers={showChannelNumbers}
                  />
                ))}
              </Collapse>
              <Divider />
            </Box>
          ))
        ) : (
          // Show flat list when searching or in other tabs
          filteredChannels.slice(0, 50).map((channel) => (
            <React.Fragment key={channel.channel_number}>
              <ChannelListItem 
                channel={channel}
                selected={channel.channel_number === selectedChannel?.channel_number}
                onSelect={handleChannelSelect}
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