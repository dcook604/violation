# User Management Implementation Details

## Database Schema

### User Model
```python
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(128), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    is_active = db.Column(db.Boolean, default=False)
    role = db.Column(db.String(50), default='user')
    temp_password = db.Column(db.String(128))
    temp_password_expiry = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
```

## Key Components

### Password Management
- Uses `werkzeug.security` for password hashing
- Temporary passwords use `secrets.token_urlsafe(12)` for secure generation
- Password expiry tracked via `temp_password_expiry` field

### Role System
- Roles: 'user', 'manager', 'admin'
- Admin role automatically sets `is_admin=True`
- Role changes handled through `set_role()` method

### Security Features
- Password hashing for both regular and temporary passwords
- Automatic temporary password expiration
- Session management with Flask-Login
- Role-based access control

## API Methods

### User Creation
```python
@classmethod
def generate_temp_password(cls)  # Generates secure temporary password
def set_temporary_password(self, expiry_hours=24)  # Sets up temporary access
```

### User Management
```python
def promote_to_admin(self)  # Promotes user to admin role
def activate(self, is_admin=False)  # Activates user account
def set_role(self, role)  # Updates user role with validation
```

### Password Handling
```python
def check_temporary_password(self, password)  # Validates temporary password
def clear_temporary_password(self)  # Removes temporary access
def update_last_login(self)  # Updates login timestamp
```

## Routes and Endpoints

### User Management Routes
- `/admin/users` - List all users
- `/admin/users/create` - Create new user
- `/admin/users/<id>/edit` - Edit user details
- `/admin/users/<id>/delete` - Delete user
- `/admin/users/<id>/change-password` - Change user password

## Forms

### User Creation Form
- Email validation
- Role selection
- Active status toggle

### User Edit Form
- Email update
- Role modification
- Temporary password reset option

### Password Change Form
- New password input
- Password confirmation
- Minimum length validation 

# PDF Generation Implementation

## PDF Generation Methods

### PDF Generation with WeasyPrint
- Uses WeasyPrint 61.2 with fallback mechanisms
- Direct rendering with memory buffer as primary method
- Temporary file approach as first fallback
- wkhtmltopdf as secondary fallback option

### Compatibility Considerations
- WeasyPrint 61.2 has known compatibility issues with pydyf library
- Comprehensive error handling and logging for all PDF generation attempts
- Multiple redundancy methods ensure PDF availability

## Key Components

### PDF Generation Process
```python
def generate_pdf(html_content):
    # Primary approach: Direct rendering to memory buffer
    try:
        buffer = BytesIO()
        HTML(string=html_content).write_pdf(buffer)
        buffer.seek(0)
        return buffer
    except Exception as e:
        logger.error(f"Direct PDF generation failed: {e}")
        
        # First fallback: Using temporary files
        try:
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                HTML(string=html_content).write_pdf(temp_pdf.name)
                return open(temp_pdf.name, 'rb')
        except Exception as e:
            logger.error(f"Temporary file PDF generation failed: {e}")
            
            # Second fallback: wkhtmltopdf
            try:
                buffer = BytesIO()
                pdfkit.from_string(html_content, buffer)
                buffer.seek(0)
                return buffer
            except Exception as e:
                logger.error(f"wkhtmltopdf generation failed: {e}")
                raise PDFGenerationError("All PDF generation methods failed")
```

# Violations List Implementation

## Pagination System

### Pagination Implementation
- Frontend pagination with server-side data fetching
- Page size options: 5, 10, 25, 50 items per page
- API supports offset/limit parameters for efficient data retrieval

### Date Filtering
- Quick filter options: Last 7 Days, Last 30 Days, All Time
- Filter parameters passed to API endpoint
- Maintains loading state during filter changes

## API Endpoints

### Violations Listing Endpoint
```python
@app.route('/api/violations', methods=['GET'])
def get_violations():
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 10, type=int)
    date_filter = request.args.get('date_filter', 'all')
    
    # Date filter logic
    query = Violation.query
    if date_filter == '7days':
        query = query.filter(Violation.created_at >= datetime.utcnow() - timedelta(days=7))
    elif date_filter == '30days':
        query = query.filter(Violation.created_at >= datetime.utcnow() - timedelta(days=30))
    
    # Pagination
    offset = (page - 1) * per_page
    violations = query.order_by(Violation.created_at.desc()).offset(offset).limit(per_page).all()
    total = query.count()
    
    return jsonify({
        'violations': [v.to_dict() for v in violations],
        'total': total,
        'page': page,
        'per_page': per_page,
        'pages': (total + per_page - 1) // per_page
    })
```

# Dashboard Enhancements

## Recent Violations Table

### Category Display
- Fixed category name display in dashboard recent violations table
- Updated API to provide category information in violation list
- Maintains backward compatibility with existing dashboard functionality

### Document Links
- Improved styling for HTML/PDF document links
- Better visibility with distinct button designs
- Updated API to ensure document links are always available 

# Navigation Implementation

## Dropdown Menu

### Violations Dropdown
- Implemented dropdown navigation for Violations section
- Contains "Violations List" and "Approvals" options
- Uses React useRef and useEffect hooks for proper positioning
- Click-outside detection to close dropdown automatically
- Automatic close on page navigation

### Dropdown Positioning
```jsx
// Fixed positioning with dynamic calculations
<div 
  className="fixed bg-white shadow-lg rounded-md border border-gray-200 w-48 z-50 overflow-hidden"
  style={{
    top: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().bottom + 8 : 0,
    left: dropdownRef.current ? dropdownRef.current.getBoundingClientRect().left : 0,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
  }}
>
  {/* Dropdown options */}
</div>
```

### User Experience
- Visual highlighting for active navigation items
- Consistent styling with main navigation
- Enhanced shadow and border effects for better visibility
- Smooth transitions for hover and active states

# Security Enhancements

## Password Security

### Argon2id Password Hashing
- Uses Argon2id, the winner of the Password Hashing Competition
- Configured with time_cost=3, memory_cost=65536 (64MB), parallelism=4
- Automatically migrates passwords from Werkzeug's default hashing
- Includes automatic hash rehashing when parameters change

### Account Lockout
```python
class User(UserMixin, db.Model):
    # Max failed login attempts before lockout
    MAX_FAILED_ATTEMPTS = 10
    
    # Account lockout fields
    failed_login_attempts = db.Column(db.Integer, default=0)
    last_failed_login = db.Column(db.DateTime)
    account_locked_until = db.Column(db.DateTime)
    password_algorithm = db.Column(db.String(20), default='argon2')
```

## Login Security

### Failed Login Handling
- Tracks failed login attempts per user
- Provides warnings when approaching the lockout threshold
- Temporarily locks accounts after 10 failed attempts
- 30-minute automatic lockout period

### Account Unlocking
```python
@auth.route('/api/auth/unlock-account', methods=['POST', 'OPTIONS'])
@cors_preflight
@login_required
def unlock_account():
    """Admin endpoint to unlock a locked user account"""
    if not current_user.is_admin:
        return jsonify({'error': 'Admin permissions required'}), 403
    
    # ... implementation details ...
```

## Security Migration

### Database Migration
- Updated password_hash field length to accommodate Argon2id hashes
- Added fields for tracking login attempts and account locks
- Migration includes both Alembic and direct SQL scripts
- Graceful handling of existing password hashes

### Password Migration
- Seamless migration during user login
- No user disruption during transition
- Multiple hash verification strategies for compatibility 

# Session Management Implementation

## Session Security

### Session Timeouts
```python
# Session timeout settings in app/config.py
PERMANENT_SESSION_LIFETIME = timedelta(hours=24)  # Absolute timeout
IDLE_TIMEOUT_MINUTES = 30  # Idle timeout in minutes
```

### User Session Model
```python
class UserSession(db.Model):
    __tablename__ = 'user_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    token = db.Column(db.String(64), unique=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_activity = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    user_agent = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
```

## Session Workflows

### Session Creation
- Token-based session management with secure UUIDs
- Flask-Login handles authentication 
- Additional UserSession tracks session details
- Session tokens stored as HttpOnly cookies

### Session Validation
- Absolute timeout of 24 hours from creation
- Idle timeout of 30 minutes since last activity
- Activity auto-refreshed on any authenticated request
- Expired sessions are automatically terminated

### Multi-Session Control
- Option to enforce single session per user
- Upon login, all other sessions are terminated
- Users can view and manage their active sessions
- Admin users can terminate any user's sessions

## API Endpoints

### Session Management Routes
- `/api/auth/active-sessions` - List all active sessions for current user
- `/api/auth/terminate-sessions` - Terminate all other sessions
- `/api/auth/terminate-session/<id>` - Terminate a specific session
- `/api/auth/session` - Validate current session status

### Session Token Security
- Session tokens are 128-bit UUIDs stored as HttpOnly cookies
- Tokens are validated against stored sessions on every request
- Tokens are invalidated upon logout
- Cookies cleared on both client and server during logout

## Password Reset Implementation

### Token Generation
- Uses `itsdangerous.URLSafeTimedSerializer` with a unique salt (`password-reset-salt`) and the app's `SECRET_KEY`.
- Token contains the `user_id` and has a built-in expiration timestamp (24 hours).
- Token is generated in the `/api/auth/request-password-reset` endpoint.

### Email Sending
- A dedicated utility `app/mail_utils.py` handles email construction and sending.
- Uses `Flask-Mail` configured with SMTP settings fetched from the `Settings` database model.
- Uses an HTML template `app/templates/email/password_reset.html` for consistent styling.

### Reset Process
- User clicks link (`/reset-password/<token>`) sent via email.
- Frontend `ResetPasswordPage.js` captures the token and new password.
- Backend endpoint `/api/auth/reset-password/<token>` validates the token using `itsdangerous.loads()` with `max_age=86400`.
- If valid, updates the user's password hash using `user.set_password()`.
- **Security:** Invalidates all existing user sessions using `user.terminate_all_sessions()`.

### Rate Limiting
- The `/api/auth/request-password-reset` endpoint is rate-limited using `Flask-Limiter`.
- **IP Limit:** "50 per hour; 10 per 5 minutes" (default key: remote IP address).
- **Email Limit:** "3 per hour" (key: target email from JSON payload).
- This combination prevents general IP flooding and targeted email spamming.
- Currently uses memory storage (consider Redis for production).

# Loading State Management Implementation

## Loading Components

### Spinner Component
```jsx
// Reusable spinner component with configurable properties
function Spinner({ size = 'md', color = 'blue', className = '' }) {
  // Size classes for different spinner sizes
  const sizeClasses = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  // Color classes for different spinner colors
  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white'
  };

  // SVG-based spinner with animation
  return (
    <div className={`inline-block ${className}`} role="status" aria-label="Loading">
      <svg 
        className={`animate-spin ${sizeClasses[size] || sizeClasses.md} ${colorClasses[color] || colorClasses.blue}`}
        xmlns="http://www.w3.org/2000/svg" 
        fill="none" 
        viewBox="0 0 24 24"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    </div>
  );
}
```

### LoadingOverlay Component
```jsx
// Full-screen loading overlay with message
function LoadingOverlay({ isLoading, message = 'Processing...', opacity = 80 }) {
  return isLoading ? (
    <div 
      className={`fixed inset-0 flex flex-col items-center justify-center z-50 bg-black bg-opacity-${opacity}`}
      style={{ backdropFilter: 'blur(2px)' }}
    >
      <Spinner size="xl" color="white" className="mb-4" />
      <div className="text-white text-lg font-semibold">{message}</div>
    </div>
  ) : null;
}
```

## Violation Submission Process

### Loading State Management
- Two-phase loading state for form submission:
  1. Initial violation data submission
  2. File uploads (if any)
- Uses global window properties to track upload status:
  - `window.isUploadingFiles`: Flag to indicate active file uploads
  - `window.latestViolationId`: Stores ID of newly created violation

### Loading State in NewViolationPage
```jsx
function NewViolationPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form submission handler with loading state management
  const handleSubmit = async (values) => {
    setIsSubmitting(true);
    try {
      const response = await API.post('/api/violations', values);
      // Keep loading state active during file uploads
      if (Object.keys(values.files || {}).length === 0) {
        setIsSubmitting(false);
        navigate(`/violations/${response.data.id}`);
      }
      return response.data;
    } catch (error) {
      setIsSubmitting(false);
      console.error('Error creating violation:', error);
      alert('Failed to create violation: ' + (error.message || 'Unknown error'));
    }
  };
  
  return (
    <Layout>
      {/* Context-sensitive loading message */}
      <LoadingOverlay 
        isLoading={isSubmitting} 
        message={
          window.isUploadingFiles 
            ? "Uploading files... Please wait" 
            : "Creating violation... Please wait"
        } 
      />
      
      <DynamicViolationForm 
        onSubmit={handleSubmit} 
        onFileUploadsComplete={() => {
          setIsSubmitting(false);
          navigate(`/violations/${window.latestViolationId}`);
        }}
      />
    </Layout>
  );
}
```

### File Upload Implementation
```jsx
const uploadFiles = async (violationId) => {
  // Set global flags for tracking upload state
  window.latestViolationId = violationId;
  window.isUploadingFiles = true;
  
  for (const [fieldName, files] of Object.entries(fileUploads)) {
    if (!files || files.length === 0) continue;
    
    const formData = new FormData();
    formData.append('field_name', fieldName);
    
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });
    
    try {
      await API.post(`/api/violations/${violationId}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
    } catch (err) {
      console.error(`Failed to upload files for ${fieldName}:`, err);
      setErrors(prev => ({
        ...prev,
        [fieldName]: `Failed to upload files: ${err.message || 'Unknown error'}`
      }));
    }
  }
  
  // Reset global upload flag when complete
  window.isUploadingFiles = false;
  
  // Notify parent component that uploads are complete
  if (onFileUploadsComplete) {
    onFileUploadsComplete();
  }
};
```

## UI Feedback During Load
- Loading spinner during initial form field fetching
- Full-screen loading overlay during form submission and file uploads
- Context-sensitive loading messages based on current operation
- Proper error handling with UI feedback for failed operations

## Accessibility Considerations
- Loading spinners have appropriate ARIA attributes (`role="status"`, `aria-label="Loading"`)
- Visual feedback through animation and color
- Text descriptions in loading overlays to indicate process status 

## Unit Profiles Implementation

### Database Schema

The `unit_profiles` table stores all information related to a unit:

- `id`: Primary key (auto-increment)
- `unit_number`: Unique identifier for the unit (VARCHAR(50))
- `strata_lot_number`: Optional strata lot identifier (VARCHAR(50))
- `owner_first_name`: First name of the owner (VARCHAR(100))
- `owner_last_name`: Last name of the owner (VARCHAR(100))
- `owner_email`: Email contact for the owner (VARCHAR(255))
- `owner_telephone`: Phone contact for the owner (VARCHAR(50))
- `owner_mailing_address`: Optional mailing address (TEXT)
- `parking_stall_numbers`: Comma-separated list of parking stalls (VARCHAR(255))
- `bike_storage_numbers`: Comma-separated list of bike storage locations (VARCHAR(255))
- `has_dog`: Boolean flag indicating presence of dogs
- `has_cat`: Boolean flag indicating presence of cats
- `is_rented`: Boolean flag indicating rental status
- `tenant_first_name`: First name of tenant if applicable (VARCHAR(100))
- `tenant_last_name`: Last name of tenant if applicable (VARCHAR(100))
- `tenant_email`: Email contact for tenant if applicable (VARCHAR(255))
- `tenant_telephone`: Phone contact for tenant if applicable (VARCHAR(50))
- `created_at`: Timestamp of creation
- `updated_at`: Timestamp of last update
- `updated_by`: Foreign key to users table (soft reference, can be NULL if user deleted)

The schema includes a unique constraint on `unit_number` to enforce data integrity, and a foreign key constraint for `updated_by` with `ON DELETE SET NULL` to maintain referential integrity even if a user is deleted.

### Model Implementation

The `UnitProfile` model is defined in `app/models.py` with all the necessary fields and a `to_dict()` method for serialization. The model uses SQLAlchemy relationships to connect to the `User` model for tracking updates.

### API Endpoints

Unit Profile data is exposed through several API endpoints:

- `GET /api/units` - List all unit profiles
- `GET /api/units/<unit_number>` - Get details for a specific unit
- `POST /api/units` - Create a new unit profile
- `PUT /api/units/<unit_number>` - Update an existing unit profile
- `DELETE /api/units/<unit_number>` - Delete a unit profile

### Frontend Components

The Unit Profile UI is implemented using React components:

- `UnitListPage` - Displays all units with filtering and sorting options
- `UnitProfileDetailPage` - Shows detailed information for a specific unit
- `UnitProfileForm` - Form for creating or editing unit profiles 

# JWT Authentication and Security (Updated)

## Cookie-Based CSRF Protection
- As of [date], explicit CSRF tokens and the /api/csrf-token endpoint have been removed.
- CSRF protection is now enforced by browser SameSite cookie policy:
  - All authentication cookies (JWT, session) are set with:
    - `SameSite=Lax`
    - `HttpOnly=True`
    - `Secure=True` (**must be True in production!**, set to False only for local development)
- No CSRF token headers are required or accepted by the backend.

## JWT Cookie Settings
- In production: 
  - `JWT_COOKIE_SAMESITE = 'Lax'`
  - `JWT_COOKIE_HTTPONLY = True`
  - `JWT_COOKIE_SECURE = True` (**must be True in production!**)
  - `JWT_COOKIE_CSRF_PROTECT = True` (optional extra security layer)

- In development: 
  - `JWT_COOKIE_SAMESITE = None` (Python None value, not string 'None')
  - `JWT_COOKIE_HTTPONLY = True`
  - `JWT_COOKIE_SECURE = False` (only for local development with HTTP)
  - `JWT_COOKIE_CSRF_PROTECT = False` (required when SameSite=None)

> **WARNING:**
> For production deployments, always set `JWT_COOKIE_SECURE = True` to ensure cookies are only sent over HTTPS. Only set it to `False` for local development and testing.
>
> When using `SameSite=None`, frontend API requests must include `withCredentials: true` to ensure cookies are sent with cross-origin requests.
> 
> Modern browsers (especially Chrome) require cookies with `SameSite=None` to also be `Secure=True`. This presents a challenge for HTTP development servers. If cookies aren't working in development, consider using Firefox with more lenient cookie settings or set up HTTPS locally.

## Rationale
- Production: Modern browsers block cookies on cross-origin POSTs when SameSite=Lax is set, preventing CSRF by design.
- Development: SameSite=None allows cookies to be sent in cross-origin requests, which is needed when frontend and backend are on different ports.

## Migration Note
- As of [date], all CSRF token logic has been removed. If you need cross-origin POSTs in the future, you must reintroduce CSRF tokens for those endpoints.
- **For production, always use `JWT_COOKIE_SECURE = True`.** 

# Authentication

## Remember Me Functionality (Login Page)

- **Objective**: Provide a "Remember Me" option on the login page to pre-fill the user's email address for convenience.
- **Implementation Details**:
    - A "Remember me" checkbox has been added to the `frontend/src/views/auth/Login.js` component.
    - Client-side `localStorage` is used to store the email address:
        - If the user successfully logs in with "Remember me" checked, their email is stored under the key `rememberedEmail`.
        - If the user logs in with "Remember me" unchecked, any existing `rememberedEmail` is removed from `localStorage`.
    - On component mount, `Login.js` checks `localStorage` for `rememberedEmail`. If found, the email input is pre-filled, and the "Remember me" checkbox is checked.
    - The user's password is **never** stored in `localStorage` or any client-side storage.
    - The `logout` function in `frontend/src/context/AuthContext.js` has been updated to explicitly remove `rememberedEmail` from `localStorage` to ensure data is cleared on explicit logout.
- **Affected Files**:
    - `frontend/src/views/auth/Login.js`: UI changes, state management for the checkbox, logic to read/write email to `localStorage`.
    - `frontend/src/context/AuthContext.js`: Modification to `logout` function to clear `localStorage`.

## Client-Side Idle Timeout

- **Objective**: Automatically log out users after 30 minutes of UI inactivity to enhance security.
- **Implementation Details (in `frontend/src/context/AuthContext.js`):**
    - **Durations**: 
        - `IDLE_TIMEOUT_DURATION`: 30 minutes.
        - `WARNING_DURATION_BEFORE_TIMEOUT`: 2 minutes (modal shown 2 minutes before final logout).
    - **Timers**: `useRef` is used for `idleTimerRef` and `warningTimerRef` to manage `setTimeout` IDs.
    - **Activity Detection**: Event listeners (`mousemove`, `keydown`, `click`, `scroll`, `touchstart`) are attached to the `window`.
        - Any detected activity calls `resetIdleTimers`.
    - **`resetIdleTimers` Function**:
        - Clears existing warning and idle timeouts.
        - Hides the warning modal.
        - If a user is logged in, sets new timeouts for showing the warning modal and for automatic logout.
    - **Warning Modal**: 
        - A state variable `showIdleWarningModal` controls its visibility.
        - The modal provides "Stay Logged In" (calls `resetIdleTimers`) and "Logout Now" (calls `logout`) options.
    - **Automatic Logout**: If the idle timer expires, `logoutDueToInactivity` is called, which triggers the main `logout` function.
    - **Lifecycle Management**: `useEffect` hooks manage the setup and cleanup of event listeners and timers based on user login status.
- **User Experience**:
    - Users are warned 2 minutes before automatic logout.
    - Activity on the site resets the inactivity countdown.
- **Affected Files**:
    - `frontend/src/context/AuthContext.js`: Core logic for idle detection, timer management, modal display, and event handling.