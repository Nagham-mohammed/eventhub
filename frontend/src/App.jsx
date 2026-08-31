
import { useEffect, useState } from 'react';
import { api } from './api';
import Dashboard from './Dashboard';

export default function App() {
  const [mode, setMode] = useState('login');

  const [token, setToken] = useState(
    () => localStorage.getItem('token')
  );

  const [userId, setUserId] = useState(
    () => localStorage.getItem('userId')
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [catalog, setCatalog] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);

  const [tab, setTab] = useState('catalog');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [reviewText, setReviewText] = useState('');
  const [reviewResult, setReviewResult] = useState(null);

 
  useEffect(() => {
    if (!token || !userId) return;

    loadCatalog();
    loadReviews();
    loadBookings();
  }, [token, userId]);

  async function loadCatalog() {
    try {
      setError('');

      const data = await api.catalog();
      setCatalog(data);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadReviews() {
    try {
      const data = await api.reviews();
      setReviews(data || []);
    } catch (err) {
      console.error('Failed to load reviews:', err);
    }
  }

  async function loadBookings() {
    try {
      if (!userId) return;

      const data = await api.bookings(userId);
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();

    try {
      setError('');
      setMessage('');

      const result = await api.register(email, password);

      setMessage(
        `Registration successful for ${result.email}. You can now login.`
      );

      setMode('login');
      setPassword('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();

    try {
      setError('');
      setMessage('');

      const result = await api.login(email, password);

      localStorage.setItem('token', result.token);

      let currentUserId = null;

      try {
        const payload = JSON.parse(
          atob(result.token.split('.')[1])
        );

        currentUserId = payload.sub;
      } catch {
        console.warn('Could not decode JWT');
      }

      if (currentUserId) {
        localStorage.setItem('userId', currentUserId);
        setUserId(currentUserId);
      }

      setToken(result.token);
      setMessage('Login successful!');
    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');

    setToken(null);
    setUserId(null);
    setCatalog([]);
    setBookings([]);
    setReviews([]);
    setReviewResult(null);
    setMessage('');
  }

  async function handleBook(eventId) {
    try {
      setError('');
      setMessage('');

      if (!userId) {
        setError(
          'User ID was not found in the token. Please login again.'
        );
        return;
      }

      const booking = await api.book(userId, eventId);

      setMessage(
        `Booking successful! Booking ID: ${booking.id}`
      );

      await loadBookings();

      setTab('bookings');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleReview(bookingId) {
    try {
      setError('');
      setMessage('');
      setReviewResult(null);

      if (!reviewText.trim()) {
        setError('Please write a review first.');
        return;
      }

      const result = await api.review(
        bookingId,
        reviewText
      );

      setReviewResult(result);
      setReviewText('');

     
      await loadReviews();

      setMessage('Review submitted successfully!');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!token) {
    return (
      <div
        style={{
          maxWidth: 450,
          margin: '80px auto',
          padding: 30,
          fontFamily: 'sans-serif',
          border: '1px solid #ddd',
          borderRadius: 10,
        }}
      >
        <h1>EventHub</h1>

        <h2>
          {mode === 'login' ? 'Login' : 'Create Account'}
        </h2>

        {error && (
          <p style={{ color: 'crimson' }}>
            {error}
          </p>
        )}

        {message && (
          <p style={{ color: 'green' }}>
            {message}
          </p>
        )}

        <form
          onSubmit={
            mode === 'login'
              ? handleLogin
              : handleRegister
          }
        >
          <div style={{ marginBottom: 15 }}>
            <label>Email</label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 5,
              }}
            />
          </div>

          <div style={{ marginBottom: 15 }}>
            <label>Password</label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                padding: 8,
                marginTop: 5,
              }}
            />
          </div>

          <button type="submit">
            {mode === 'login'
              ? 'Login'
              : 'Register'}
          </button>
        </form>

        <hr style={{ margin: '25px 0' }} />

        <button
          onClick={() => {
            setMode(
              mode === 'login'
                ? 'register'
                : 'login'
            );
            setError('');
            setMessage('');
          }}
        >
          {mode === 'login'
            ? 'Create new account'
            : 'Already have an account? Login'}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: 'sans-serif',
        padding: '2rem',
        maxWidth: 1100,
        margin: 'auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <h1>EventHub</h1>

        <button onClick={logout}>
          Logout
        </button>
      </div>

      <p>
        Logged in as: <strong>{userId}</strong>
      </p>

      {error && (
        <p style={{ color: 'crimson' }}>
          {error}
        </p>
      )}

      {message && (
        <p style={{ color: 'green' }}>
          {message}
        </p>
      )}

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={() => setTab('catalog')}
          disabled={tab === 'catalog'}
        >
          Catalog
        </button>{' '}

        <button
          onClick={() => setTab('bookings')}
          disabled={tab === 'bookings'}
        >
          My Bookings
        </button>{' '}

        <button
          onClick={() => setTab('dashboard')}
          disabled={tab === 'dashboard'}
        >
          Dashboard
        </button>
      </div>

      {/* ================= CATALOG ================= */}

      {tab === 'catalog' && (
        <div>
          <h2>Events Catalog</h2>

          {catalog.length === 0 ? (
            <p>
              No events found. Make sure the catalog
              database contains events.
            </p>
          ) : (
            <div>
              {catalog.map((event) => {
                const eventReviews = reviews.filter(
                  (review) =>
                    Number(review.eventId) === Number(event.id)
                );

                return (
                  <div
                    key={event.id}
                    style={{
                      border: '1px solid #ddd',
                      borderRadius: 8,
                      padding: 15,
                      marginBottom: 15,
                    }}
                  >
                    <h3>{event.title}</h3>

                    <p>
                      Price: ${event.price}
                    </p>

                    <button
                      onClick={() =>
                        handleBook(event.id)
                      }
                    >
                      Book Event
                    </button>

                    {/* ================= REVIEWS ================= */}

                    <div
                      style={{
                        marginTop: 15,
                        paddingTop: 10,
                        borderTop: '1px solid #eee',
                      }}
                    >
                      <h4>
                        Reviews ({eventReviews.length})
                      </h4>

                      {eventReviews.length === 0 ? (
                        <p style={{ color: '#777' }}>
                          No reviews yet.
                        </p>
                      ) : (
                        eventReviews.map((review) => (
                          <div
                            key={review.id}
                            style={{
                              marginTop: 10,
                              padding: 12,
                              background: '#f7f7f7',
                              borderRadius: 6,
                            }}
                          >
                            <p>
                              <strong>Review:</strong>{' '}
                              {review.text}
                            </p>

                            <p>
                              <strong>Sentiment:</strong>{' '}
                              {review.sentiment}
                            </p>

                            {review.summary && (
                              <p>
                                <strong>Summary:</strong>{' '}
                                {review.summary}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {}

      {tab === 'bookings' && (
        <div>
          <h2>My Bookings</h2>

          {bookings.length === 0 ? (
            <p>No bookings yet.</p>
          ) : (
            bookings.map((booking) => (
              <div
                key={booking.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 8,
                  padding: 15,
                  marginBottom: 15,
                }}
              >
                <p>
                  <strong>Event:</strong>{' '}
                  {catalog.find(
                    (event) =>
                      event.id === booking.eventId
                  )?.title ||
                    `Event ${booking.eventId}`}
                </p>

                <p>
                  <strong>Status:</strong>{' '}
                  {booking.status}
                </p>

                <textarea
                  placeholder="Write your review..."
                  value={reviewText}
                  onChange={(e) =>
                    setReviewText(e.target.value)
                  }
                  rows={4}
                  style={{
                    width: '100%',
                    marginBottom: 10,
                  }}
                />

                <button
                  onClick={() =>
                    handleReview(booking.id)
                  }
                >
                  Submit Review
                </button>

                {reviewResult &&
                  reviewResult.bookingId ===
                    booking.id && (
                    <div
                      style={{
                        marginTop: 15,
                        padding: 10,
                        background: '#f5f5f5',
                      }}
                    >
                      <strong>
                        AI Sentiment:{' '}
                      </strong>

                      {reviewResult.sentiment}

                      <br />

                      <strong>
                        Summary:{' '}
                      </strong>

                      {reviewResult.summary}
                    </div>
                  )}
              </div>
            ))
          )}
        </div>
      )}

      {}

      {tab === 'dashboard' && (
        <Dashboard />
      )}
    </div>
  );
}

