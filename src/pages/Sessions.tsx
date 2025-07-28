import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  AccessTime as TimeIcon,
  AttachMoney as MoneyIcon,
  Message as MessageIcon,
} from '@mui/icons-material';
import { getAllSessions, deleteSession, getSessionStats, type Session } from '../db/sessions';
import { format } from 'date-fns';

interface SessionsProps {
  onSelectSession: (sessionId: number) => void;
}

const Sessions = ({ onSelectSession }: SessionsProps) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    totalDuration: 0,
    totalCost: 0,
    averageDuration: 0,
    totalMessages: 0,
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<number | null>(null);


  const loadSessions = async () => {
    try {
      const [sessionsData, statsData] = await Promise.all([
        getAllSessions(),
        getSessionStats(),
      ]);
      setSessions(sessionsData);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleDeleteClick = (sessionId: number) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (sessionToDelete) {
      try {
        await deleteSession(sessionToDelete);
        await loadSessions();
      } catch (error) {
        console.error('Error deleting session:', error);
      }
    }
    setDeleteDialogOpen(false);
    setSessionToDelete(null);
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Chat Sessions
      </Typography>

      {/* Statistics */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageIcon color="primary" />
            <Box>
              <Typography variant="h6">{stats.totalSessions}</Typography>
              <Typography variant="body2" color="text.secondary">Total Sessions</Typography>
            </Box>
          </Box>
        </Paper>
        
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <TimeIcon color="primary" />
            <Box>
              <Typography variant="h6">{formatDuration(Math.round(stats.totalDuration || 0))}</Typography>
              <Typography variant="body2" color="text.secondary">Total Duration</Typography>
            </Box>
          </Box>
        </Paper>
        
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MoneyIcon color="primary" />
            <Box>
              <Typography variant="h6">${stats.totalCost.toFixed(2)}</Typography>
              <Typography variant="body2" color="text.secondary">Total Cost</Typography>
            </Box>
          </Box>
        </Paper>
        
        <Paper sx={{ p: 2, flex: 1, minWidth: 200 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageIcon color="primary" />
            <Box>
              <Typography variant="h6">{stats.totalMessages}</Typography>
              <Typography variant="body2" color="text.secondary">Total Messages</Typography>
            </Box>
          </Box>
        </Paper>
      </Box>

      {/* Sessions Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Date</TableCell>
              <TableCell>Duration</TableCell>
              <TableCell>Model</TableCell>
              <TableCell>Tokens Used</TableCell>
              <TableCell>Cost</TableCell>
              <TableCell>Devices</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No sessions yet. Start a chat to see your sessions here.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((session) => (
                <TableRow key={session.id} hover>
                  <TableCell>
                    {format(new Date((session.start_time || 0) * 1000), 'MMM d, yyyy h:mm a')}
                  </TableCell>
                  <TableCell>{formatDuration(session.duration_seconds)}</TableCell>
                  <TableCell>
                    <Chip label={session.model} size="small" color="primary" variant="outlined" />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ fontSize: '0.875rem' }}>
                      <div>Audio: {(session.input_audio_tokens + session.output_audio_tokens).toLocaleString()}</div>
                      <div>Text: {(session.input_text_tokens + session.output_text_tokens).toLocaleString()}</div>
                    </Box>
                  </TableCell>
                  <TableCell>${session.total_cost.toFixed(2)}</TableCell>
                  <TableCell>
                    <Box sx={{ fontSize: '0.75rem' }}>
                      <div>{session.mic_device}</div>
                      <div>{session.speaker_device}</div>
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={() => onSelectSession(session.id!)}
                      color="primary"
                      title="View session"
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleDeleteClick(session.id!)}
                      color="error"
                      title="Delete session"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Session?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this session? This action cannot be undone.
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Sessions;
