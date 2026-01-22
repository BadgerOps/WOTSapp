import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PostCard from './PostCard';

describe('PostCard', () => {
  it('should display author name for regular posts', () => {
    const post = {
      id: '1',
      title: 'Test Post',
      content: 'Test content',
      type: 'general',
      status: 'published',
      authorId: 'user1',
      authorName: 'John Doe',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Test Post')).toBeInTheDocument();
    expect(screen.getByText('Test content')).toBeInTheDocument();
    expect(screen.getByText('Posted by John Doe')).toBeInTheDocument();
  });

  it('should display approver name for weather-based posts', () => {
    const post = {
      id: '2',
      title: 'UOTD: Uniform #1',
      content: 'Weather-based uniform recommendation',
      type: 'uotd',
      status: 'published',
      authorId: 'admin1',
      authorName: 'Admin User',
      approvedByName: 'Admin User',
      weatherBased: true,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('UOTD: Uniform #1')).toBeInTheDocument();
    expect(
      screen.getByText('Weather-based UOTD approved by Admin User')
    ).toBeInTheDocument();
  });

  it('should display formatted date', () => {
    const post = {
      id: '3',
      title: 'Test Post',
      content: 'Content',
      type: 'announcement',
      authorId: 'user1',
      authorName: 'Test User',
      createdAt: new Date('2026-01-15T12:00:00Z'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText(/Jan 1[45], 2026/)).toBeInTheDocument();
  });

  it('should display correct badge for post type', () => {
    const post = {
      id: '4',
      title: 'Important Update',
      content: 'Content',
      type: 'announcement',
      authorId: 'user1',
      authorName: 'Admin',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Announcement')).toBeInTheDocument();
  });

  it('should display UOTD badge for uniform posts', () => {
    const post = {
      id: '5',
      title: 'Uniform Update',
      content: 'Today\'s uniform',
      type: 'uotd',
      authorId: 'user1',
      authorName: 'Admin',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('UOTD')).toBeInTheDocument();
  });

  it('should display schedule badge for schedule posts', () => {
    const post = {
      id: '6',
      title: 'Schedule Change',
      content: 'New schedule',
      type: 'schedule',
      authorId: 'user1',
      authorName: 'Admin',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Schedule')).toBeInTheDocument();
  });

  it('should handle missing authorName gracefully', () => {
    const post = {
      id: '7',
      title: 'Test Post',
      content: 'Content',
      type: 'general',
      authorId: 'user1',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Posted by Unknown')).toBeInTheDocument();
  });

  it('should display multi-line content correctly', () => {
    const post = {
      id: '8',
      title: 'Test Post',
      content: 'Line 1\nLine 2\nLine 3',
      type: 'general',
      authorId: 'user1',
      authorName: 'Test User',
      createdAt: new Date('2026-01-19T12:00:00Z'),
    };

    render(<PostCard post={post} />);

    const contentElement = screen.getByText(/Line 1/);
    expect(contentElement).toBeInTheDocument();
    expect(contentElement.textContent).toBe('Line 1\nLine 2\nLine 3');
  });

  it('should handle Firestore timestamp objects', () => {
    const post = {
      id: '9',
      title: 'Test Post',
      content: 'Content',
      type: 'general',
      authorId: 'user1',
      authorName: 'Test User',
      createdAt: {
        toDate: () => new Date('2026-01-19T12:00:00Z'),
      },
    };

    render(<PostCard post={post} />);

    expect(screen.getByText(/Jan 1[89], 2026/)).toBeInTheDocument();
  });

  it('should prioritize weather-based attribution over regular author', () => {
    const post = {
      id: '10',
      title: 'Weather UOTD',
      content: 'Content',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'System User',
      approvedByName: 'Jane Admin',
      weatherBased: true,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(
      screen.getByText('Weather-based UOTD approved by Jane Admin')
    ).toBeInTheDocument();
    expect(screen.queryByText('Posted by System User')).not.toBeInTheDocument();
  });

  it('should fall back to regular author if weatherBased but no approvedByName', () => {
    const post = {
      id: '11',
      title: 'Weather UOTD',
      content: 'Content',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherBased: true,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Posted by Admin User')).toBeInTheDocument();
  });

  it('should display admin note if present', () => {
    const post = {
      id: '12',
      title: 'Formation',
      content: 'Morning formation at 0800',
      type: 'announcement',
      authorId: 'admin1',
      authorName: 'Admin User',
      adminNote: 'Bring PT gear and water bottle',
      createdAt: new Date('2026-01-19T12:00:00Z'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Formation')).toBeInTheDocument();
    expect(screen.getByText('Morning formation at 0800')).toBeInTheDocument();
    expect(screen.getByText(/Note:/)).toBeInTheDocument();
    expect(screen.getByText(/Bring PT gear and water bottle/)).toBeInTheDocument();
  });

  it('should not display admin note section if empty', () => {
    const post = {
      id: '13',
      title: 'Test Post',
      content: 'Content',
      type: 'general',
      authorId: 'admin1',
      authorName: 'Admin User',
      adminNote: '',
      createdAt: new Date('2026-01-19T12:00:00Z'),
    };

    render(<PostCard post={post} />);

    expect(screen.queryByText(/Note:/)).not.toBeInTheDocument();
  });

  it('should not display admin note section if only whitespace', () => {
    const post = {
      id: '14',
      title: 'Test Post',
      content: 'Content',
      type: 'general',
      authorId: 'admin1',
      authorName: 'Admin User',
      adminNote: '   ',
      createdAt: new Date('2026-01-19T12:00:00Z'),
    };

    render(<PostCard post={post} />);

    expect(screen.queryByText(/Note:/)).not.toBeInTheDocument();
  });

  it('should display Cold weather badge for low temperatures', () => {
    const post = {
      id: '15',
      title: 'UOTD',
      content: 'Cold weather uniform',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherBased: true,
      weatherCondition: 'Clear',
      weatherTemp: 35,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Cold')).toBeInTheDocument();
  });

  it('should display Warm weather badge for moderate temperatures', () => {
    const post = {
      id: '16',
      title: 'UOTD',
      content: 'Warm weather uniform',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherBased: true,
      weatherCondition: 'Clear',
      weatherTemp: 72,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Warm')).toBeInTheDocument();
  });

  it('should display Wet weather badge for rainy conditions', () => {
    const post = {
      id: '17',
      title: 'UOTD',
      content: 'Rainy day uniform',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherBased: true,
      weatherCondition: 'Rain',
      weatherTemp: 55,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Wet')).toBeInTheDocument();
  });

  it('should display Snow weather badge for snowy conditions', () => {
    const post = {
      id: '18',
      title: 'UOTD',
      content: 'Snowy day uniform',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherBased: true,
      weatherCondition: 'Snow',
      weatherTemp: 28,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.getByText('Snow')).toBeInTheDocument();
  });

  it('should not display weather badge for non-UOTD posts', () => {
    const post = {
      id: '19',
      title: 'Announcement',
      content: 'General announcement',
      type: 'announcement',
      authorId: 'admin1',
      authorName: 'Admin User',
      weatherCondition: 'Clear',
      weatherTemp: 72,
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.queryByText('Warm')).not.toBeInTheDocument();
  });

  it('should not display weather badge when weatherCondition is missing', () => {
    const post = {
      id: '20',
      title: 'UOTD',
      content: 'Manual UOTD post',
      type: 'uotd',
      authorId: 'admin1',
      authorName: 'Admin User',
      createdAt: new Date('2026-01-19'),
    };

    render(<PostCard post={post} />);

    expect(screen.queryByText('Cold')).not.toBeInTheDocument();
    expect(screen.queryByText('Warm')).not.toBeInTheDocument();
    expect(screen.queryByText('Wet')).not.toBeInTheDocument();
  });
});
